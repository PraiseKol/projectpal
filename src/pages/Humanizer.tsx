import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Copy, Check, Loader2, Download, Info, ShieldCheck, FileText, Columns2 } from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { getFunctionErrorMessage } from "@/utils/errorMessages";

const MAX_CHARS = 25000;

type Strength = "light" | "medium" | "strong";
type Tone = "academic" | "plain" | "professional";

interface SegmentResult {
  original: string;
  rewritten: string;
  status: "rewritten" | "protected" | "unchanged";
  reason?: string;
  sepAfter: string;
}

interface TextStats {
  words: number;
  sentences: number;
  avgSentence: number;
  variety: number;
  stock: number;
  stockFound: Record<string, number>;
}

interface Report {
  before: TextStats;
  after: TextStats;
  citations: { total: number; intact: number };
  numbers: { total: number; intact: number };
  passages: { total: number; rewritten: number; protected: number; unchanged: number };
}

interface Result {
  text: string;
  segments: SegmentResult[];
  report: Report;
}

const STRENGTHS: { value: Strength; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Fixes stock phrases and clumsy wording. Keeps most of your sentences." },
  { value: "medium", label: "Medium", hint: "Rephrases most sentences. Keeps the order of your ideas." },
  { value: "strong", label: "Strong", hint: "Rewrites thoroughly in fresh wording. Every idea stays." },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "academic", label: "Formal academic" },
  { value: "plain", label: "Plain and clear" },
  { value: "professional", label: "Professional" },
];

// ---------------------------------------------------------------------------------------------
// Word-level comparison: marks the words that were removed and the words that were added
// ---------------------------------------------------------------------------------------------
interface Piece {
  t: string;
  changed: boolean;
}

const diffText = (a: string, b: string): { left: Piece[]; right: Piece[] } | null => {
  const A = a.split(/(\s+)/).filter(Boolean);
  const B = b.split(/(\s+)/).filter(Boolean);
  const n = A.length;
  const m = B.length;
  if (n * m > 250000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: Piece[] = [];
  const right: Piece[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      left.push({ t: A[i], changed: false });
      right.push({ t: B[j], changed: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ t: A[i], changed: !/^\s+$/.test(A[i]) });
      i++;
    } else {
      right.push({ t: B[j], changed: !/^\s+$/.test(B[j]) });
      j++;
    }
  }
  while (i < n) {
    left.push({ t: A[i], changed: !/^\s+$/.test(A[i]) });
    i++;
  }
  while (j < m) {
    right.push({ t: B[j], changed: !/^\s+$/.test(B[j]) });
    j++;
  }
  return { left, right };
};

const Highlighted = ({ pieces, tone }: { pieces: Piece[]; tone: "removed" | "added" }) => (
  <>
    {pieces.map((p, i) =>
      p.changed ? (
        <mark
          key={i}
          className={tone === "removed" ? "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200 rounded-sm" : "bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200 rounded-sm"}
        >
          {p.t}
        </mark>
      ) : (
        <span key={i}>{p.t}</span>
      )
    )}
  </>
);

const Metric = ({ label, before, after, note }: { label: string; before?: string | number; after: string | number; note: string }) => (
  <div className="rounded-lg border p-3 space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">
      {before !== undefined && <span className="text-muted-foreground font-normal">{before} → </span>}
      {after}
    </p>
    <p className="text-xs text-muted-foreground">{note}</p>
  </div>
);

const Humanizer = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [strength, setStrength] = useState<Strength>("medium");
  const [tone, setTone] = useState<Tone>("academic");
  const [keepTerms, setKeepTerms] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"result" | "compare">("result");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cost, setCost] = useState(5);
  const [credits, setCredits] = useState<{ daily: number; monthly: number; paid: number; plan: string } | null>(null);

  const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
  const isOverCharLimit = inputText.length > MAX_CHARS;

  // Text sent over from the chat
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("pp_humanizer_prefill");
      if (prefill) {
        setInputText(prefill);
        sessionStorage.removeItem("pp_humanizer_prefill");
      }
    } catch {
      /* storage not available */
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Live cost from admin settings
      const { data: settings } = await supabase.from("app_settings").select("key, value").eq("key", "credit_cost_humanizer");
      if (settings?.[0]) {
        const val = parseInt(settings[0].value, 10);
        if (!isNaN(val)) setCost(val);
      }
      // Current balance so users see what they can afford
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_type, daily_credits, monthly_credits, paid_credits, credits_expiry_date")
        .eq("id", user.id)
        .single();
      if (profile) {
        const expired = profile.credits_expiry_date ? new Date(profile.credits_expiry_date) < new Date() : true;
        setCredits({
          daily: profile.daily_credits ?? 0,
          monthly: profile.monthly_credits ?? 0,
          paid: profile.plan_type !== "free" && !expired ? profile.paid_credits ?? 0 : 0,
          plan: profile.plan_type,
        });
      }
    })();
  }, []);

  const handleRewrite = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("humanize-text", {
        body: { text: inputText, strength, tone, keepTerms },
      });
      if (error) {
        const message = await getFunctionErrorMessage(error);
        toast.error(message || "Something went wrong. Please try again.");
        return;
      }
      if (!data || data.error) {
        toast.error(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setResult({ text: data.humanizedText, segments: data.segments ?? [], report: data.report });
      setView("result");
      if (data.profile) {
        setCredits((prev) =>
          prev
            ? { ...prev, daily: data.profile.daily_credits, monthly: data.profile.monthly_credits, paid: data.profile.paid_credits }
            : prev
        );
      }
      toast.success(`Done. ${data.credits_used} credits used.`);
    } catch {
      toast.error("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rewritten-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const comparisons = useMemo(
    () => (result ? result.segments.map((s) => (s.status === "rewritten" ? diffText(s.original, s.rewritten) : null)) : []),
    [result]
  );

  const stockFound = result
    ? Object.entries(result.report.before.stockFound)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="AI Humanizer | ProjectPal"
        description="Rewrite text so it reads naturally and clearly, while keeping your meaning, numbers and citations."
        keywords="text rewriter, natural writing, academic writing, paraphrase, editing"
      />

      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">AI Humanizer</h1>
            <Badge variant="secondary" className="text-xs">
              {cost} Credits
            </Badge>
            {credits && (
              <Badge variant="outline" className="text-xs">
                You have {credits.plan === "free" ? Math.min(credits.daily, credits.monthly) : credits.daily + credits.paid} credits
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paste your text</CardTitle>
            <CardDescription>
              The rewriter makes your draft read naturally and clearly. It keeps your meaning, numbers, citations and quotations, and leaves
              headings and reference lists untouched.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className={`min-h-[200px] resize-y ${isOverCharLimit ? "border-destructive" : ""}`}
              disabled={isLoading}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>How much should it change?</Label>
                <div className="flex gap-2">
                  {STRENGTHS.map((s) => (
                    <Button key={s.value} type="button" size="sm" variant={strength === s.value ? "default" : "outline"} onClick={() => setStrength(s.value)} disabled={isLoading} className="flex-1">
                      {s.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{STRENGTHS.find((s) => s.value === strength)?.hint}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hz-tone">Tone</Label>
                <select
                  id="hz-tone"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  disabled={isLoading}
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={keepTerms}
                  onChange={(e) => setKeepTerms(e.target.value)}
                  placeholder="Keep these terms exactly (optional), separated by commas"
                  disabled={isLoading}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs ${isOverCharLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {wordCount(inputText)} words • {inputText.length.toLocaleString()}/{MAX_CHARS.toLocaleString()} characters
                {isOverCharLimit && " — over the limit, trim your text"}
              </span>
              <Button onClick={handleRewrite} disabled={isLoading || !inputText.trim() || isOverCharLimit} className="gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rewriting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Rewrite
                  </>
                )}
              </Button>
            </div>
            {isLoading && (
              <p className="text-xs text-muted-foreground">Long texts are rewritten in parts and checked as they go. This can take up to a minute.</p>
            )}
          </CardContent>
        </Card>

        {/* Honest note */}
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Good to know: no tool can promise how any AI detector will score a text, and detectors sometimes flag genuine writing. Follow your
            institution's rules on AI use, add your own examples and analysis, and keep your notes and drafts. That is what makes the work yours.
          </p>
        </div>

        {/* Output */}
        {result && !isLoading && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant={view === "result" ? "default" : "outline"} onClick={() => setView("result")} className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Result
                    </Button>
                    <Button size="sm" variant={view === "compare" ? "default" : "outline"} onClick={() => setView("compare")} className="gap-1.5">
                      <Columns2 className="h-3.5 w-3.5" /> Compare changes
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {view === "result" ? (
                  <>
                    <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed border">{result.text}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {wordCount(result.text)} words (was {wordCount(inputText)})
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      <mark className="bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200 rounded-sm px-1">Red</mark> words were replaced.{" "}
                      <mark className="bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200 rounded-sm px-1">Green</mark> words are new.
                    </p>
                    {result.segments.map((s, i) => {
                      if (s.status === "protected") {
                        return (
                          <div key={i} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                            <p className="text-xs font-medium mb-1">Kept as written ({s.reason})</p>
                            <p className="whitespace-pre-wrap">{s.original}</p>
                          </div>
                        );
                      }
                      if (s.status === "unchanged") {
                        return (
                          <div key={i} className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
                            <p className="text-xs font-medium mb-1 text-amber-800 dark:text-amber-300">
                              Left unchanged: the rewrite did not pass the safety checks for numbers, citations or length, so your wording is kept.
                            </p>
                            <p className="whitespace-pre-wrap">{s.original}</p>
                          </div>
                        );
                      }
                      const d = comparisons[i];
                      return (
                        <div key={i} className="grid md:grid-cols-2 gap-3">
                          <div className="rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
                            {d ? <Highlighted pieces={d.left} tone="removed" /> : s.original}
                          </div>
                          <div className="rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Rewritten</p>
                            {d ? <Highlighted pieces={d.right} tone="added" /> : s.rewritten}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quality report */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Quality report
                </CardTitle>
                <CardDescription>
                  A check on writing quality and on whether your facts survived. It is not an AI-detector score, and no tool can promise how a
                  detector will rate any text.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <Metric
                    label="Stock AI phrases"
                    before={result.report.before.stock}
                    after={result.report.after.stock}
                    note="Phrases like “moreover” or “plays a crucial role”. Fewer reads more naturally."
                  />
                  <Metric
                    label="Sentence variety"
                    before={result.report.before.variety}
                    after={result.report.after.variety}
                    note="How much sentence length varies. Higher means a more natural mix of short and long."
                  />
                  <Metric
                    label="Average sentence length"
                    before={`${result.report.before.avgSentence} words`}
                    after={`${result.report.after.avgSentence} words`}
                    note="Very long sentences are harder to read."
                  />
                  <Metric
                    label="Citations kept"
                    after={`${result.report.citations.intact} of ${result.report.citations.total}`}
                    note="Citations and quotations that are word-for-word identical."
                  />
                  <Metric
                    label="Numbers kept"
                    after={`${result.report.numbers.intact} of ${result.report.numbers.total}`}
                    note="Every figure, date and percentage in your original."
                  />
                  <Metric
                    label="Passages rewritten"
                    after={`${result.report.passages.rewritten} of ${result.report.passages.rewritten + result.report.passages.unchanged}`}
                    note={
                      result.report.passages.unchanged > 0
                        ? `${result.report.passages.unchanged} left unchanged by the safety checks.`
                        : `${result.report.passages.protected} headings or reference entries kept as written.`
                    }
                  />
                </div>
                {stockFound.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Stock phrases found in your original: {stockFound.map(([p, n]) => `${p} (${n})`).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Humanizer;
