import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google's models can be slow or overloaded. Wait only a limited time, then switch to the other model.
const GEMINI_FAST_MODEL = Deno.env.get('GEMINI_LITE_MODEL') ?? 'gemini-3.5-flash-lite';
const GEMINI_STRONG_MODEL = Deno.env.get('GEMINI_STRONG_MODEL') ?? 'gemini-3.8-flash';
const GEMINI_RETRY_STATUSES = [429, 500, 502, 503, 504];

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    // The timer only covers waiting for the answer to start, so streaming replies are not cut off
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGemini(url: string, init: RequestInit): Promise<Response> {
  const isImage = /image/.test(url);

  try {
    const res = await fetchWithTimeout(url, init, 35000);
    if (!GEMINI_RETRY_STATUSES.includes(res.status)) return res;
    console.warn(`[GEMINI] ${res.status} from the first model, trying the other one`);
  } catch (e) {
    console.warn('[GEMINI] first model too slow or failed, trying the other one:', String(e).slice(0, 80));
  }

  // Work out which model was used, then switch to the other one (image calls keep their own model)
  let currentModel = url.match(/\/models\/([^/:]+):/)?.[1] ?? '';
  let fallbackInit: RequestInit = init;
  if (typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.model) currentModel = body.model;
    } catch {
      /* body is not JSON */
    }
  }
  const alternative = currentModel === GEMINI_FAST_MODEL ? GEMINI_STRONG_MODEL : GEMINI_FAST_MODEL;
  let fallbackUrl = url;
  if (!isImage) {
    fallbackUrl = url.replace(/\/models\/[^/:]+:/, `/models/${alternative}:`);
    if (typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body.model) fallbackInit = { ...init, body: JSON.stringify({ ...body, model: alternative }) };
      } catch {
        /* body is not JSON */
      }
    }
  }

  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (const wait of [1000, 2500]) {
    await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetchWithTimeout(fallbackUrl, fallbackInit, 45000);
      if (!GEMINI_RETRY_STATUSES.includes(res.status)) return res;
      lastResponse = res;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error('AI service is not responding');
}

// ======================= Natural rewriting engine =======================
const MAX_CHARS = 25000;
const CHUNK_CHARS = 1800;
const LONG_PARAGRAPH = 2200;

// Stock phrasing that makes writing sound generic. Used to guide the rewrite and to report progress.
const STOCK_PHRASES = [
  'delve', 'delves', 'delving', 'moreover', 'furthermore', 'in conclusion', 'it is important to note',
  'it is worth noting', 'it should be noted', 'plays a crucial role', 'plays a pivotal role', 'plays a vital role',
  'tapestry', 'multifaceted', 'underscores', 'underscore', 'a testament to', 'navigate the complexities',
  "in today's digital age", 'in the realm of', 'in the ever-evolving', 'ever-evolving', 'leverage', 'leveraging',
  'utilize', 'utilizes', 'utilizing', 'robust', 'seamless', 'seamlessly', 'pivotal', 'intricate', 'meticulous',
  'embark', 'unlock the potential', 'game-changer', 'paradigm shift', 'holistic', 'synergy', 'foster', 'fosters',
  'facilitate', 'facilitates', 'comprehensive', 'crucial', 'landscape', 'shed light on', 'sheds light on',
  'a myriad of', 'plethora', 'in light of', 'it is essential', 'not only', 'on the other hand',
];

const stockRegexes = STOCK_PHRASES.map((p) => ({ p, re: new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi') }));

const stockByLength = [...stockRegexes].sort((a, b) => b.p.length - a.p.length);

function countStock(text: string): { total: number; found: Record<string, number> } {
  const found: Record<string, number> = {};
  let total = 0;
  let work = text;
  for (const { p, re } of stockByLength) {
    const m = work.match(re);
    if (m && m.length) {
      found[p] = (found[p] ?? 0) + m.length;
      total += m.length;
      work = work.replace(re, ' ');
    }
  }
  return { total, found };
}

const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201C(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function textStats(text: string) {
  const sentences = splitSentences(text);
  const lengths = sentences.map(wordCount);
  const n = lengths.length;
  const avg = n ? lengths.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
  const stock = countStock(text);
  return {
    words: wordCount(text),
    sentences: n,
    avgSentence: Math.round(avg * 10) / 10,
    variety: avg ? Math.round((sd / avg) * 100) / 100 : 0,
    stock: stock.total,
    stockFound: stock.found,
  };
}

// Things the rewrite must never change: numbers, citations and quoted passages
function protectedTokens(text: string): { numbers: string[]; citations: string[] } {
  const numbers = [...new Set(text.match(/\d[\d,.]*\d|\d/g) ?? [])];
  const citations: string[] = [];
  for (const m of text.matchAll(/\(([^()]*?\b(?:19|20)\d{2}[a-z]?[^()]*?)\)/g)) citations.push(m[0]);
  for (const m of text.matchAll(/[A-Z][A-Za-z'\u2019-]+(?: et al\.| (?:and|&) [A-Z][A-Za-z'\u2019-]+)? \((?:19|20)\d{2}[a-z]?\)/g)) citations.push(m[0]);
  for (const m of text.matchAll(/"[^"\n]{10,}"|\u201C[^\u201D\n]{10,}\u201D/g)) citations.push(m[0]);
  return { numbers, citations: [...new Set(citations)] };
}

function missingProtected(original: string, rewritten: string): string[] {
  const { numbers, citations } = protectedTokens(original);
  return [...citations, ...numbers].filter((t) => !rewritten.includes(t));
}

// ---------- splitting the text into segments ----------
interface Segment {
  text: string;
  keep: boolean;            // headings, reference lists: passed through untouched
  isList: boolean;
  sepAfter: string;
  reason?: string;
}

const REF_HEADING = /^\s*(references?|reference list|bibliography|works cited|table of (cases|statutes)|appendix|appendices)\s*:?\s*$/i;
const LIST_LINE = /^\s*([-*\u2022]|\d+[.)])\s+/;

function looksLikeHeading(block: string): boolean {
  const t = block.trim();
  if (t.includes('\n')) return false;
  const words = wordCount(t);
  if (words === 0) return true;
  if (words <= 12 && !/[.,;:!?]$/.test(t)) return true;
  if (/^(chapter|section|part)\s+\w+/i.test(t) && words <= 16) return true;
  return false;
}

function buildSegments(text: string): Segment[] {
  const blocks = text.split(/\n{2,}/).map((b) => b.replace(/\s+$/, '')).filter((b) => b.trim());
  const segments: Segment[] = [];
  let inReferences = false;

  for (const block of blocks) {
    if (REF_HEADING.test(block.trim())) {
      inReferences = true;
      segments.push({ text: block, keep: true, isList: false, sepAfter: '\n\n', reason: 'heading' });
      continue;
    }
    if (inReferences) {
      segments.push({ text: block, keep: true, isList: false, sepAfter: '\n\n', reason: 'reference list' });
      continue;
    }
    if (looksLikeHeading(block)) {
      segments.push({ text: block, keep: true, isList: false, sepAfter: '\n\n', reason: 'heading' });
      continue;
    }
    const lines = block.split('\n').filter((l) => l.trim());
    const isList = lines.length > 1 && lines.filter((l) => LIST_LINE.test(l)).length >= Math.ceil(lines.length * 0.6);
    if (!isList && block.length > LONG_PARAGRAPH) {
      // a very long paragraph is rewritten in sentence groups but joined back into one paragraph
      const sentences = splitSentences(block);
      let current = '';
      const parts: string[] = [];
      for (const s of sentences) {
        if (current && (current + ' ' + s).length > CHUNK_CHARS) {
          parts.push(current);
          current = s;
        } else {
          current = current ? current + ' ' + s : s;
        }
      }
      if (current) parts.push(current);
      parts.forEach((p, i) =>
        segments.push({ text: p, keep: false, isList: false, sepAfter: i === parts.length - 1 ? '\n\n' : ' ' })
      );
      continue;
    }
    segments.push({ text: block, keep: false, isList, sepAfter: '\n\n' });
  }
  return segments;
}

function makeChunks(segments: Segment[]): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let size = 0;
  segments.forEach((seg, i) => {
    if (seg.keep) return;
    if (current.length && (size + seg.text.length > CHUNK_CHARS || current.length >= 6)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(i);
    size += seg.text.length;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

// ---------- the instruction to the AI ----------
type Strength = 'light' | 'medium' | 'strong';
type Tone = 'academic' | 'plain' | 'professional';

function buildSystemPrompt(strength: Strength, tone: Tone, keepTerms: string): string {
  const strengthText: Record<Strength, string> = {
    light:
      'LIGHT EDIT: keep the writer\'s sentence order and most of the wording. Replace stock phrases and clumsy or repetitive wording, smooth awkward transitions, and tighten padded sentences. Change roughly a third of the sentences.',
    medium:
      'MEDIUM REWRITE: rephrase most sentences in fresh wording. You may reorder clauses, merge two short sentences, or split a long one when it reads better. Keep the order of ideas.',
    strong:
      'STRONG REWRITE: rewrite each passage thoroughly in different words and sentence shapes, while keeping every idea, claim and its order. Merge, split and reshape sentences freely.',
  };
  const toneText: Record<Tone, string> = {
    academic: 'Formal academic English, third person, no contractions, precise vocabulary. It must still read like a person wrote it.',
    plain: 'Clear everyday English: short, direct sentences, common words, no slang. Contractions are fine where natural.',
    professional: 'Clear, confident professional English suitable for reports and business documents. Avoid jargon unless the original uses it.',
  };
  return `You are a careful human editor. You rewrite passages so they read like natural, confident human writing, while keeping the author's meaning EXACTLY.

${strengthText[strength]}

TONE: ${toneText[tone]}

KEEP EXACTLY AS WRITTEN (never change, translate, move or drop these):
- every number, date, percentage, statistic and unit (write digits as digits)
- every citation, for example (Smith, 2020) or Smith and Jones (2019), and every quoted passage in quotation marks
- names of people, places, organisations, laws, cases, products and technical terms
- list markers and line breaks inside lists (keep the same number of lines)${keepTerms ? `\n- these terms, exactly: ${keepTerms}` : ''}

NEVER:
- add facts, examples or opinions that are not in the original, or remove any idea
- introduce spelling or grammar mistakes, awkward phrasing, or odd word choices on purpose: the result must be correct, polished writing
- use markdown, headings, bullet symbols or bold; write plain text only

WRITE LIKE A PERSON, NOT LIKE A TEMPLATE:
- vary sentence length naturally: some short, some long, where it helps the reader
- prefer concrete, specific wording over abstract filler
- avoid stock phrases such as: delve, moreover, furthermore, in conclusion, it is important to note, plays a crucial role, multifaceted, tapestry, landscape, leverage, utilize, robust, seamless, pivotal, foster, facilitate, "not only ... but also" used repeatedly
- do not start consecutive sentences the same way, and do not use em dashes more than rarely

FORMAT: the input has several passages, each starting with a marker like [[P1]]. Return every passage, in the same order, each starting with its own marker exactly as given, and nothing else (no introduction, no notes).`;
}

// ---------- rewriting one chunk with checks ----------
const RATIO: Record<Strength, [number, number]> = { light: [0.8, 1.25], medium: [0.65, 1.4], strong: [0.55, 1.6] };
const TEMPERATURE: Record<Strength, number> = { light: 0.5, medium: 0.7, strong: 0.85 };

function parseMarked(output: string, ids: number[]): (string | null)[] {
  const parts = output.split(/\[\[P(\d+)\]\]/);
  const found = new Map<number, string>();
  for (let i = 1; i < parts.length; i += 2) found.set(parseInt(parts[i], 10), (parts[i + 1] ?? '').trim());
  return ids.map((id) => (found.has(id) && (found.get(id) as string).length > 0 ? (found.get(id) as string) : null));
}

function cleanOutput(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*\*?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function checkSegment(original: Segment, rewritten: string, strength: Strength, keepTerms: string[]): string | null {
  const inWords = wordCount(original.text);
  const outWords = wordCount(rewritten);
  if (inWords >= 8) {
    const [lo, hi] = RATIO[strength];
    const r = outWords / inWords;
    if (r < lo || r > hi) return `the length changed too much (${inWords} words became ${outWords})`;
  }
  const missing = missingProtected(original.text, rewritten);
  if (missing.length > 0) return `these were changed or dropped, keep them exactly: ${missing.slice(0, 8).join(' | ')}`;
  for (const term of keepTerms) {
    if (original.text.toLowerCase().includes(term.toLowerCase()) && !rewritten.toLowerCase().includes(term.toLowerCase())) {
      return `the required term "${term}" was changed`;
    }
  }
  if (original.isList) {
    const a = original.text.split('\n').filter((l) => l.trim()).length;
    const b = rewritten.split('\n').filter((l) => l.trim()).length;
    if (a !== b) return `the list must keep the same ${a} lines`;
  }
  return null;
}

interface RewriteContext {
  ask: (system: string, user: string, maxTokens: number, temperature: number) => Promise<string>;
  strength: Strength;
  keepTerms: string[];
  system: string;
  deadline: number;
}

async function rewriteChunk(segments: Segment[], indices: number[], total: number, ctx: RewriteContext): Promise<Record<number, string>> {
  const results: Record<number, string> = {};
  let pending = indices.slice();
  let notes = '';

  for (let attempt = 1; attempt <= 2 && pending.length > 0; attempt++) {
    if (Date.now() > ctx.deadline) break;
    const body = pending.map((i, n) => `[[P${n + 1}]]\n${segments[i].text}`).join('\n\n');
    const user =
      `Rewrite the following ${pending.length} passage${pending.length > 1 ? 's' : ''} (part of a longer document of ${total} passages).` +
      (notes ? `\n\nYour previous attempt had problems, so fix them this time: ${notes}` : '') +
      `\n\n${body}`;
    const words = pending.reduce((s, i) => s + wordCount(segments[i].text), 0);
    let output = '';
    try {
      output = await ctx.ask(ctx.system, user, Math.min(8000, Math.ceil(words * 2.4) + 400), TEMPERATURE[ctx.strength]);
    } catch (e) {
      console.error('[HUMANIZER] chunk call failed:', String(e).slice(0, 120));
      continue;
    }
    const ids = pending.map((_, n) => n + 1);
    const parsed = parseMarked(output, ids);
    const stillPending: number[] = [];
    const problems: string[] = [];
    pending.forEach((segIndex, n) => {
      const text = parsed[n] === null ? null : cleanOutput(parsed[n] as string);
      if (!text) {
        stillPending.push(segIndex);
        problems.push(`passage ${n + 1} is missing or empty`);
        return;
      }
      const issue = checkSegment(segments[segIndex], text, ctx.strength, ctx.keepTerms);
      if (issue) {
        stillPending.push(segIndex);
        problems.push(`passage ${n + 1}: ${issue}`);
      } else {
        results[segIndex] = text;
      }
    });
    pending = stillPending;
    notes = problems.join('; ');
  }
  return results;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function runPool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= jobs.length) break;
        results[i] = await jobs[i]();
      }
    })
  );
  return results;
}

function deductCredits(cost: number, daily: number, monthly: number, paid: number, isActiveSubscriber: boolean) {
  let remaining = cost;
  if (isActiveSubscriber) {
    if (daily >= remaining) return { success: true, daily: daily - remaining, monthly, paid };
    if (daily > 0) {
      remaining -= daily;
      daily = 0;
    }
    if (paid >= remaining) return { success: true, daily, monthly, paid: paid - remaining };
    return { success: false, daily, monthly, paid };
  }
  if (daily >= remaining && monthly >= remaining) return { success: true, daily: daily - remaining, monthly: monthly - remaining, paid };
  return { success: false, daily, monthly, paid };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const text = String(body?.text ?? '').replace(/\r\n/g, '\n');
    const strength: Strength = ['light', 'medium', 'strong'].includes(body?.strength) ? body.strength : 'medium';
    const tone: Tone = ['academic', 'plain', 'professional'].includes(body?.tone) ? body.tone : 'academic';
    const keepTerms = String(body?.keepTerms ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 20);

    if (wordCount(text) < 5) return json({ error: 'Please paste some text to rewrite (at least a sentence or two).' }, 400);
    if (text.length > MAX_CHARS) {
      return json({ error: `Your text is too long. The limit is ${MAX_CHARS.toLocaleString()} characters (about ${Math.round(MAX_CHARS / 6).toLocaleString()} words) per run. Please split it into parts.` }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (profileError) throw profileError;

    // ----- credits -----
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;
    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    const paidCredits = profile.paid_credits || 0;
    const paidExpired = profile.credits_expiry_date ? new Date(profile.credits_expiry_date) < new Date() : true;
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidExpired;

    let COST = 5;
    let DEFAULT_DAILY = 8;
    let DEFAULT_MONTHLY = 40;
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['credit_cost_humanizer', 'default_daily_credits', 'default_monthly_credits']);
    settings?.forEach((s: { key: string; value: string }) => {
      const v = parseInt(s.value);
      if (s.key === 'credit_cost_humanizer' && !isNaN(v) && v > 0) COST = v;
      if (s.key === 'default_daily_credits') DEFAULT_DAILY = v || 8;
      if (s.key === 'default_monthly_credits') DEFAULT_MONTHLY = v || 40;
    });

    if (needsDailyReset) {
      if (isActiveSubscriber) {
        dailyCredits = DEFAULT_DAILY;
      } else {
        const lastMonth = profile.daily_reset_date ? new Date(profile.daily_reset_date).getMonth() : -1;
        if (lastMonth !== new Date().getMonth()) monthlyCredits = DEFAULT_MONTHLY;
        dailyCredits = monthlyCredits > 0 ? Math.min(DEFAULT_DAILY, monthlyCredits) : 0;
      }
    }
    const available = isActiveSubscriber ? dailyCredits + paidCredits : Math.min(dailyCredits, monthlyCredits);
    if (available < COST) {
      return json({ error: `This needs ${COST} credits. You have ${available} remaining.`, credits_required: COST }, 402);
    }

    // ----- rewrite -----
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY not configured');

    const segments = buildSegments(text);
    const chunks = makeChunks(segments);
    const rewritable = segments.filter((s) => !s.keep).length;
    if (rewritable === 0) {
      return json({ error: 'This text only contains headings or a reference list, so there is nothing to rewrite.' }, 400);
    }

    const ask = async (system: string, user: string, maxTokens: number, temperature: number): Promise<string> => {
      const res = await fetchGemini('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`AI service answered ${res.status}`);
      const data = await res.json();
      const out = data?.choices?.[0]?.message?.content;
      if (typeof out !== 'string' || !out.trim()) throw new Error('Empty answer');
      return out;
    };

    const ctx: RewriteContext = {
      ask,
      strength,
      keepTerms,
      system: buildSystemPrompt(strength, tone, keepTerms.join(', ')),
      // stop starting new work in time to answer before the platform's own time limit
      deadline: Date.now() + 100000,
    };

    const partResults = await runPool(chunks.map((c) => () => rewriteChunk(segments, c, rewritable, ctx)), 4);
    const results: Record<number, string> = Object.assign({}, ...partResults);
    const rewrittenCount = Object.keys(results).length;

    if (rewrittenCount === 0) {
      return json({ error: 'The text could not be rewritten safely this time, so it was left unchanged. No credits were used. Please try again.' }, 502);
    }

    const output = segments.map((s, i) => (results[i] ?? s.text) + s.sepAfter).join('').trim();

    const segmentReport = segments.map((s, i) => ({
      original: s.text,
      rewritten: results[i] ?? s.text,
      status: s.keep ? 'protected' : results[i] !== undefined ? 'rewritten' : 'unchanged',
      reason: s.keep ? s.reason : undefined,
      sepAfter: s.sepAfter,
    }));

    const before = textStats(text);
    const after = textStats(output);
    const origTokens = protectedTokens(text);
    const report = {
      before,
      after,
      citations: { total: origTokens.citations.length, intact: origTokens.citations.filter((c) => output.includes(c)).length },
      numbers: { total: origTokens.numbers.length, intact: origTokens.numbers.filter((n) => output.includes(n)).length },
      passages: {
        total: segments.length,
        rewritten: rewrittenCount,
        protected: segments.filter((s) => s.keep).length,
        unchanged: rewritable - rewrittenCount,
      },
      strength,
      tone,
    };

    // ----- charge only now that it worked -----
    const paid = deductCredits(COST, dailyCredits, monthlyCredits, paidCredits, isActiveSubscriber);
    if (!paid.success) return json({ error: 'Insufficient credits' }, 402);
    await supabaseClient
      .from('profiles')
      .update({ daily_credits: paid.daily, monthly_credits: paid.monthly, paid_credits: paid.paid, daily_reset_date: today })
      .eq('id', user.id);

    console.log(`[HUMANIZER] ${rewrittenCount}/${rewritable} passages rewritten (${strength}, ${tone}), ${before.words} -> ${after.words} words`);

    return json({
      humanizedText: output,
      credits_used: COST,
      segments: segmentReport,
      report,
      profile: { daily_credits: paid.daily, monthly_credits: paid.monthly, paid_credits: paid.paid, credits_expiry_date: profile.credits_expiry_date },
    });
  } catch (e) {
    console.error('humanize-text error:', e);
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500);
  }
});
