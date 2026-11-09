import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------- Google AI call with a time limit and a switch to the other model ----------
const FAST_MODEL = Deno.env.get('GEMINI_LITE_MODEL') ?? 'gemini-3.5-flash-lite';
const STRONG_MODEL = Deno.env.get('GEMINI_STRONG_MODEL') ?? 'gemini-3.8-flash';
const RETRY_STATUSES = [429, 500, 502, 503, 504];
const URL_CHAT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function askModel(system: string, user: string, maxTokens: number): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const primary = Deno.env.get('GEMINI_MODEL') ?? FAST_MODEL;
  const models = [primary, primary === FAST_MODEL ? STRONG_MODEL : FAST_MODEL, primary];

  let lastError: unknown = null;
  for (let i = 0; i < models.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 800 * i));
    try {
      const res = await fetchWithTimeout(
        URL_CHAT,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: models[i],
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        },
        i === 0 ? 40000 : 50000
      );
      if (RETRY_STATUSES.includes(res.status)) {
        lastError = new Error(`AI service answered ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`AI service answered ${res.status}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) return text;
      lastError = new Error('Empty answer');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('AI service is not responding');
}

// ---------- helpers ----------
const TITLES: Record<string, string> = {
  descriptive: 'Descriptive Statistics',
  frequencies: 'Socio-Demographic Characteristics of Respondents (Frequency Analysis)',
  likert: 'Likert Scale Analysis',
  correlation_pearson: 'Pearson Correlation Analysis',
  correlation_spearman: 'Spearman Correlation Analysis',
  ttest_independent: 'Independent Samples T-Test',
  ttest_paired: 'Paired Samples T-Test',
  chi_square: 'Chi-Square Test of Independence',
  anova_oneway: 'One-Way Analysis of Variance (ANOVA)',
  anova_twoway: 'Two-Way Analysis of Variance (ANOVA)',
  ancova: 'Analysis of Covariance (ANCOVA)',
  regression_linear: 'Multiple Linear Regression Analysis',
  regression_logistic: 'Binary Logistic Regression Analysis',
  factor_analysis: 'Exploratory Factor Analysis',
  mannwhitney_u: 'Mann-Whitney U Test',
  kruskal_wallis: 'Kruskal-Wallis H Test',
  wilcoxon_signed_rank: 'Wilcoxon Signed-Rank Test',
};

const DROP_KEYS = new Set([
  'interpretation', 'qqPlot', 'qqPlotData', 'histogram', 'histogramData', 'histograms',
  'residualPlot', 'residuals', 'scatterData', 'rawData', 'chartData',
]);

function compact(v: any, depth = 0): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
  if (typeof v === 'string') return v.length > 300 ? v.slice(0, 300) + '...' : v;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    const items = v.slice(0, 25).map((x) => compact(x, depth + 1));
    return v.length > 25 ? [...items, `... ${v.length - 25} more items`] : items;
  }
  if (typeof v === 'object') {
    if (depth > 6) return undefined;
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = compact(val, depth + 1);
    }
    return out;
  }
  return undefined;
}

function dataFor(value: any, limit: number): string {
  const text = JSON.stringify(compact(value));
  return text.length > limit ? text.slice(0, limit) + ' ...(shortened)' : text;
}

function clean(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*\*?/g, '')
    .replace(/(^|\s)\*(\S[^*\n]*?)\*(?=\s|[.,;:]|$)/g, '$1$2')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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

const SYSTEM = `You are an experienced university research supervisor in Nigeria who writes Chapter Four (Data Presentation, Analysis and Interpretation) of undergraduate and postgraduate research projects.

WRITING RULES:
- Formal academic English in the third person. Use the past tense when reporting what was found.
- Write flowing paragraphs separated by one blank line. Do NOT use markdown or any special symbols: no #, no asterisks, no bullet points, no numbered lists. Do not write a heading for the section you are given because the heading is added automatically.
- Report every statistic exactly as it appears in the DATA. Never change a number and never invent a number that is not in the DATA. Use APA style for statistics (for example M = 3.42, SD = 0.81, t(98) = 2.31, p = .023, r = .45, F(2, 97) = 4.12, R-squared = .31).
- Use the 0.05 level of significance for decisions unless the data says otherwise.
- Never invent citations, authors, years or named studies. You may refer in general terms to "previous studies" or "the existing literature".
- Refer to tables and figures as "the table above" or "the figure above" because numbering is added later.
- Write substantive, detailed, submission-ready academic prose. Do not summarise or abbreviate. Always write at least the number of words you are asked for.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    // Writing the full chapter is a Scholar feature (an expired plan counts as free)
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type, credits_expiry_date')
      .eq('id', user.id)
      .single();
    const expired = !profile?.credits_expiry_date || new Date(profile.credits_expiry_date) < new Date();
    if (!profile || profile.plan_type === 'free' || expired) {
      return json({ error: 'Writing the full Chapter 4 is available on the Scholar plan.' }, 403);
    }

    const body = await req.json();
    const results = body?.results ?? {};
    const ctx = body?.context ?? {};
    const topic: string = String(ctx.topic ?? '').slice(0, 600);
    const hypotheses: string = String(ctx.hypotheses ?? '').slice(0, 2500);
    const sampleSize: number | null = Number.isFinite(Number(ctx.sampleSize)) && Number(ctx.sampleSize) > 0 ? Number(ctx.sampleSize) : null;
    const variables: string = Array.isArray(ctx.variables) ? ctx.variables.slice(0, 60).join(', ') : '';

    const keys = Object.keys(results).filter((k) => results[k] && typeof results[k] === 'object');
    if (keys.length === 0) return json({ error: 'No analysis results were provided.' }, 400);

    const studyContext =
      `STUDY CONTEXT:\n` +
      (topic ? `Project topic: ${topic}\n` : `Project topic: not supplied (refer to "this study" in general terms)\n`) +
      (hypotheses ? `Research questions / objectives / hypotheses supplied by the student:\n${hypotheses}\n` : `Hypotheses: not supplied (state them in general terms from the analysis)\n`) +
      (sampleSize ? `Number of respondents (sample size): ${sampleSize}\n` : '') +
      (variables ? `Variables in the dataset: ${variables}\n` : '');

    const analysisList = keys.map((k) => TITLES[k] ?? k).join(', ');
    const overview = keys.map((k) => `${TITLES[k] ?? k}: ${dataFor(results[k], 1800)}`).join('\n\n').slice(0, 16000);

    type Job = { id: string; run: () => Promise<string> };
    const jobs: Job[] = [];

    jobs.push({
      id: 'intro',
      run: () => askModel(SYSTEM,
        `${studyContext}\nThe analyses carried out were: ${analysisList}.\n\nWrite section 4.1 Introduction of Chapter Four. Explain the purpose of the chapter; how the data were collected and prepared for analysis in general terms; the statistical techniques used and why each suits the research questions; how the chapter is organised (go through the sections in order); and how tables and figures are used to present the results. Write at least 500 words.`,
        3500),
    });

    jobs.push({
      id: 'screening',
      run: () => askModel(SYSTEM,
        `${studyContext}\nThe analyses carried out were: ${analysisList}.\n\nWrite the section on Data Screening and Preparation. Cover: the sample and its description; coding and entry of the data; screening for missing values, outliers and data entry errors and how such problems are handled; checking the statistical assumptions that apply to the analyses carried out (normality, homogeneity of variance, linearity, independence of observations and multicollinearity where relevant); the reliability of the research instrument and why it matters; the software and the 0.05 level of significance used for decisions. Do not invent specific figures that are not in the context. Write at least 600 words.`,
        3500),
    });

    for (const key of keys) {
      const title = TITLES[key] ?? key;
      const minWords = ['frequencies', 'descriptive', 'likert', 'factor_analysis', 'regression_linear'].includes(key) ? 1200 : 1000;
      jobs.push({
        id: `section:${key}`,
        run: () => askModel(SYSTEM,
          `${studyContext}\nANALYSIS: ${title}\nDATA (exact values, use them exactly):\n${dataFor(results[key], 9000)}\n\nWrite the full narrative for this section of Chapter Four, in this order, each part in its own paragraphs:\n1. The purpose of the analysis and how it relates to the research question or hypothesis it answers (use the supplied hypotheses where they fit).\n2. What was tested and how: the variables, the test, and the assumptions checked and whether they were met, using the values given.\n3. A detailed presentation of the results: report every important statistic in the DATA and go through each variable, group, category, item or coefficient in turn.\n4. A careful interpretation: what the figures mean, the direction and size of any effect (with effect sizes where given), and the practical meaning for the study.\n5. The decision on the research question or hypothesis (reject or fail to reject the null hypothesis where relevant) and what it implies.\n6. A short concluding paragraph that links to the next section.\nWrite at least ${minWords} words.`,
          4500),
      });
    }

    jobs.push({
      id: 'discussion',
      run: () => askModel(SYSTEM,
        `${studyContext}\nSUMMARY OF ALL RESULTS (exact values):\n${overview}\n\nWrite the section Discussion of Findings. Bring the results of all the analyses together: discuss each major finding in turn, explain what it means in the context of the study topic, say how it relates to the research questions and hypotheses, and discuss the likely reasons for the pattern found. Compare the findings in general terms with what earlier studies and established theory would lead one to expect, WITHOUT naming any specific author, year or publication. Discuss the practical implications for the relevant stakeholders. Write at least 1300 words.`,
        4500),
    });

    jobs.push({
      id: 'summary',
      run: () => askModel(SYSTEM,
        `${studyContext}\nSUMMARY OF ALL RESULTS (exact values):\n${overview}\n\nWrite the closing section Summary of the Chapter. Summarise what the chapter presented, then restate the principal findings of every analysis in clear prose using the exact statistics, and end by explaining how the findings lead into Chapter Five (conclusion and recommendations). Write at least 500 words.`,
        3500),
    });

    const failed: string[] = [];
    const texts = await runPool(
      jobs.map((j) => async () => {
        try {
          return clean(await j.run());
        } catch (e) {
          console.error(`[CH4] ${j.id} failed:`, String(e).slice(0, 200));
          failed.push(j.id);
          return '';
        }
      }),
      6
    );

    const byId: Record<string, string> = {};
    jobs.forEach((j, i) => { byId[j.id] = texts[i]; });
    const sections: Record<string, string> = {};
    for (const key of keys) sections[key] = byId[`section:${key}`] ?? '';

    const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
    console.log(`[CH4] wrote ${words} words in ${jobs.length} parts, failed: ${failed.length}`);

    return json({
      intro: byId['intro'] ?? '',
      screening: byId['screening'] ?? '',
      sections,
      discussion: byId['discussion'] ?? '',
      summary: byId['summary'] ?? '',
      failed,
      words,
    });
  } catch (e) {
    console.error('chapter4-writer error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
