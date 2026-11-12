import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QuestionnaireData } from "./types";
import {
  buildSummaryRows,
  buildTable,
  completionRate,
  computeStats,
  downloadText,
  downloadXlsx,
  flattenQuestions,
  forwardToAnalysis,
  formUrl,
  guessWidths,
  responsesPerDay,
  safeFileName,
  toCsv,
  type FormResponse,
  type QuestionStat,
  type SharedForm,
} from "./formUtils";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const SELECTED_KEY = "pp_selected_form_id";
const PAGE_SIZE = 15;
const POLL_MS = 30000;

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---------------------------------------------------------------------------------------------
// One question's results, like the Summary page of Google Forms
// ---------------------------------------------------------------------------------------------
const QuestionResultCard = ({ stat }: { stat: QuestionStat }) => {
  const [showAll, setShowAll] = useState(false);
  const { question: q } = stat;
  const data = (stat.choices ?? []).map((c) => ({ name: c.label, count: c.count, percent: c.percent }));
  const typeLabel =
    q.type === "rating_scale" ? "Rating scale" : q.type === "multiple_choice" ? "Multiple choice" : q.type === "yes_no" ? "Yes / No" : "Written answers";

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="space-y-1">
          <p className="font-medium">
            <span className="text-primary font-bold mr-1">{q.number}.</span>
            {q.text}
          </p>
          <p className="text-xs text-muted-foreground">
            {typeLabel} · {stat.answered} {stat.answered === 1 ? "response" : "responses"}
            {stat.skipped > 0 ? ` · ${stat.skipped} skipped` : ""}
          </p>
        </div>

        {stat.answered === 0 && <p className="text-sm text-muted-foreground">No answers yet.</p>}

        {stat.answered > 0 && q.type === "rating_scale" && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Mean: <strong>{stat.mean}</strong>
              </span>
              {stat.sd !== undefined && (
                <span>
                  SD: <strong>{stat.sd}</strong>
                </span>
              )}
              {stat.median !== undefined && (
                <span>
                  Median: <strong>{stat.median}</strong>
                </span>
              )}
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, _n, item) => [`${v} (${item.payload.percent}%)`, "Responses"]} />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {stat.answered > 0 && (q.type === "yes_no" || q.type === "multiple_choice") && (
          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.filter((d) => d.count > 0)} dataKey="count" nameKey="name" outerRadius={80} innerRadius={35} paddingAngle={2}>
                    {data
                      .filter((d) => d.count > 0)
                      .map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string, item) => [`${v} (${item.payload.percent}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {data.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {d.count} ({d.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stat.answered > 0 && stat.texts && (
          <div className="space-y-2">
            {(showAll ? stat.texts : stat.texts.slice(0, 8)).map((t, i) => (
              <div key={i} className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                {t}
              </div>
            ))}
            {stat.texts.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show fewer" : `Show all ${stat.texts.length} answers`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------------------------
interface FormSharePanelProps {
  /** The questionnaire currently open in the builder */
  data: QuestionnaireData;
  /** Checks the questionnaire is complete (shows its own messages) */
  validate: () => boolean;
  /** "free" or a paid plan name */
  planType: string;
}

export const FormSharePanel = ({ data, validate, planType }: FormSharePanelProps) => {
  const navigate = useNavigate();
  const db = supabase as any;
  const isPaid = planType !== "free" && planType !== "";
  const responseCap = isPaid ? 2000 : 150;
  const formCap = isPaid ? 10 : 2;

  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<SharedForm[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [view, setView] = useState<"summary" | "responses" | "settings">("summary");
  const [page, setPage] = useState(0);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // settings (used both when publishing and when editing)
  const [requireAll, setRequireAll] = useState(false);
  const [thankYou, setThankYou] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [limitText, setLimitText] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => forms.find((f) => f.id === selectedId) ?? null, [forms, selectedId]);
  const questions = useMemo(() => (selected ? flattenQuestions(selected.schema) : []), [selected]);
  const stats = useMemo(() => computeStats(questions, responses), [questions, responses]);
  const perDay = useMemo(() => responsesPerDay(responses), [responses]);
  const completion = useMemo(() => completionRate(questions, responses), [questions, responses]);
  const lastResponse = responses.length ? responses[responses.length - 1].submitted_at : null;

  const loadForms = useCallback(async () => {
    const { data: rows, error } = await db.from("shared_forms").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load your shared forms.");
      setLoading(false);
      return;
    }
    const list = (rows ?? []) as SharedForm[];
    setForms(list);
    setSelectedId((cur) => (cur && list.some((f) => f.id === cur) ? cur : list[0]?.id ?? null));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadResponses = useCallback(
    async (formId: string, quiet = false) => {
      if (!quiet) setLoadingResponses(true);
      const { data: rows, error } = await db
        .from("form_responses")
        .select("id, form_id, answers, submitted_at")
        .eq("form_id", formId)
        .order("submitted_at", { ascending: true })
        .limit(5000);
      if (!error) setResponses((rows ?? []) as FormResponse[]);
      if (!quiet) setLoadingResponses(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  // When the chosen form changes: remember it, load its responses and its settings
  useEffect(() => {
    if (!selected) {
      setResponses([]);
      return;
    }
    try {
      localStorage.setItem(SELECTED_KEY, selected.id);
    } catch {
      /* storage not available */
    }
    setPage(0);
    loadResponses(selected.id);
    setRequireAll(selected.require_all);
    setThankYou(selected.thank_you_message ?? "");
    setIsOpen(selected.is_open);
    setLimitText(selected.response_limit ? String(selected.response_limit) : "");
    setClosesAt(toLocalInput(selected.closes_at));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the results fresh while the tab is open
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadResponses(selected.id, true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [selected?.id, loadResponses]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = selected ? formUrl(selected.slug) : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied. Paste it anywhere to share your form.");
    } catch {
      toast.error("Could not copy automatically. Select the link and copy it.");
    }
  };

  const publish = async () => {
    if (!validate()) {
      toast.error("Complete your questionnaire in the Builder tab first.");
      return;
    }
    setPublishing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const { data: row, error } = await db
        .from("shared_forms")
        .insert({
          owner_id: user.id,
          title: data.title.trim(),
          schema: data,
          require_all: requireAll,
          thank_you_message: thankYou.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      setForms((prev) => [row as SharedForm, ...prev]);
      setSelectedId((row as SharedForm).id);
      setShowPublish(false);
      setView("summary");
      toast.success("Your form is live. Copy the link and share it.");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast.error(msg.includes("FORM_LIMIT") ? msg.replace(/^.*FORM_LIMIT:\s*/, "") : "Could not publish the form. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const saveSettings = async () => {
    if (!selected) return;
    const limit = limitText.trim() ? parseInt(limitText, 10) : null;
    if (limit !== null && (!Number.isFinite(limit) || limit < 1)) {
      toast.error("The response limit must be a number above 0, or left empty.");
      return;
    }
    setSaving(true);
    const { data: row, error } = await db
      .from("shared_forms")
      .update({
        is_open: isOpen,
        require_all: requireAll,
        response_limit: limit,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        thank_you_message: thankYou.trim() || null,
      })
      .eq("id", selected.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Could not save the settings.");
      return;
    }
    setForms((prev) => prev.map((f) => (f.id === selected.id ? (row as SharedForm) : f)));
    toast.success("Settings saved.");
  };

  const updateQuestions = async () => {
    if (!selected) return;
    if (responses.length > 0) {
      toast.error("This form already has responses, so its questions are locked. Publish a new form instead.");
      return;
    }
    if (!validate()) {
      toast.error("Complete your questionnaire in the Builder tab first.");
      return;
    }
    setSaving(true);
    const { data: row, error } = await db
      .from("shared_forms")
      .update({ schema: data, title: data.title.trim() })
      .eq("id", selected.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Could not update the form.");
      return;
    }
    setForms((prev) => prev.map((f) => (f.id === selected.id ? (row as SharedForm) : f)));
    toast.success("The shared form now matches your current questionnaire.");
  };

  const deleteForm = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.title}" and all ${responses.length} of its responses? This cannot be undone.`)) return;
    const { error } = await db.from("shared_forms").delete().eq("id", selected.id);
    if (error) {
      toast.error("Could not delete the form.");
      return;
    }
    const rest = forms.filter((f) => f.id !== selected.id);
    setForms(rest);
    setSelectedId(rest[0]?.id ?? null);
    toast.success("Form deleted.");
  };

  const deleteResponse = async (id: string) => {
    if (!window.confirm("Delete this response?")) return;
    const { error } = await db.from("form_responses").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete the response.");
      return;
    }
    setResponses((prev) => prev.filter((r) => r.id !== id));
  };

  const fileBase = selected ? safeFileName(selected.title) : "questionnaire";

  const downloadCsv = () => {
    if (!selected) return;
    const { header, rows } = buildTable(questions, responses, "full");
    downloadText(`${fileBase}_responses.csv`, toCsv(header, rows));
  };

  const downloadExcel = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const full = buildTable(questions, responses, "full");
      await downloadXlsx(`${fileBase}_responses.xlsx`, [
        { name: "Responses", rows: [full.header, ...full.rows], widths: guessWidths(full.header, full.rows) },
        { name: "Summary", rows: buildSummaryRows(stats, responses.length), widths: [46, 30, 16, 12] },
      ]);
    } catch {
      toast.error("Could not create the Excel file.");
    } finally {
      setExporting(false);
    }
  };

  const sendToAnalysis = () => {
    if (!selected) return;
    if (responses.length < 3) {
      toast.error("Collect at least 3 responses before analysing them.");
      return;
    }
    try {
      forwardToAnalysis(selected.title, questions, responses);
    } catch {
      toast.error("Could not pass the responses to Data Analysis.");
      return;
    }
    toast.success("Opening your responses in Data Analysis...");
    navigate("/data-analysis");
  };

  const status = !selected
    ? null
    : !selected.is_open
      ? { label: "Closed", tone: "bg-muted text-muted-foreground" }
      : selected.closes_at && new Date(selected.closes_at) <= new Date()
        ? { label: "Closed (date passed)", tone: "bg-muted text-muted-foreground" }
        : responses.length >= Math.min(selected.response_limit ?? Infinity, responseCap)
          ? { label: "Full", tone: "bg-amber-100 text-amber-800" }
          : { label: "Accepting responses", tone: "bg-green-100 text-green-800" };

  // ---------------------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publishCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          Share your questionnaire as a link
        </CardTitle>
        <CardDescription>
          Respondents open the link and fill the form on their phone or computer, with no download and no sign-in. Their
          answers appear here with charts and statistics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">{data.title.trim() || "Your questionnaire has no title yet"}</p>
          <p className="text-muted-foreground">
            {data.sections.reduce((n, s) => n + s.questions.length, 0)} questions in {data.sections.length}{" "}
            {data.sections.length === 1 ? "section" : "sections"} will be published as they are now.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="pub-required">Make every question required</Label>
            <p className="text-xs text-muted-foreground">Respondents cannot submit until all questions are answered.</p>
          </div>
          <Switch id="pub-required" checked={requireAll} onCheckedChange={setRequireAll} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pub-thanks">Message after submitting (optional)</Label>
          <Textarea
            id="pub-thanks"
            rows={2}
            value={thankYou}
            onChange={(e) => setThankYou(e.target.value)}
            placeholder="Thank you for taking part in this survey."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Your plan allows up to {formCap} shared forms and {responseCap.toLocaleString()} responses per form.
          {!isPaid && " Scholar raises this to 10 forms and 2,000 responses per form."}
        </p>

        <div className="flex gap-2">
          <Button onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            Publish and get link
          </Button>
          {forms.length > 0 && (
            <Button variant="outline" onClick={() => setShowPublish(false)}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (forms.length === 0 || showPublish) return publishCard;

  const pagedRows = [...responses].reverse().slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm min-w-[200px] max-w-full"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title || "Untitled form"} · {new Date(f.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={() => setShowPublish(true)}>
          <Share2 className="h-4 w-4 mr-2" />
          Publish current questionnaire as new form
        </Button>
      </div>

      {selected && (
        <>
          {/* Link */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                {status && <Badge className={status.tone}>{status.label}</Badge>}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
                <div className="flex gap-2 shrink-0">
                  <Button onClick={copyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy link
                  </Button>
                  <Button variant="outline" onClick={() => window.open(link, "_blank", "noopener")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(`https://wa.me/?text=${encodeURIComponent(`${selected.title}\n${link}`)}`, "_blank", "noopener")
                    }
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Numbers + downloads */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Responses
                </p>
                <p className="text-3xl font-bold">{responses.length}</p>
                <p className="text-xs text-muted-foreground">
                  of {Math.min(selected.response_limit ?? Infinity, responseCap).toLocaleString()} allowed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completion
                </p>
                <p className="text-3xl font-bold">{completion}%</p>
                <p className="text-xs text-muted-foreground">of questions answered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Latest response
                </p>
                <p className="text-sm font-semibold mt-1">{lastResponse ? new Date(lastResponse).toLocaleString() : "None yet"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Questions
                </p>
                <p className="text-3xl font-bold">{questions.length}</p>
                <Button variant="ghost" size="sm" className="px-0 h-auto text-xs" onClick={() => loadResponses(selected.id)} disabled={loadingResponses}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${loadingResponses ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadCsv} disabled={responses.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button variant="outline" onClick={downloadExcel} disabled={responses.length === 0 || exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Download Excel
            </Button>
            <Button onClick={sendToAnalysis} disabled={responses.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              Analyse in Data Analysis
            </Button>
          </div>

          {/* Sub tabs */}
          <div className="flex gap-1 border-b">
            {(
              [
                ["summary", "Summary"],
                ["responses", `Responses (${responses.length})`],
                ["settings", "Settings"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  view === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "summary" && (
            <div className="space-y-4">
              {responses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center space-y-2">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-medium">No responses yet</p>
                    <p className="text-sm text-muted-foreground">Share your link. New responses and their charts appear here automatically.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {perDay.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Responses over time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={perDay} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="count" name="Responses" stroke="#2563eb" strokeWidth={2} dot={perDay.length < 15} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {stats.map((s) => (
                    <QuestionResultCard key={s.question.id} stat={s} />
                  ))}
                </>
              )}
            </div>
          )}

          {view === "responses" && (
            <Card>
              <CardContent className="pt-5 space-y-3">
                {responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No responses yet.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead className="min-w-[150px]">Submitted</TableHead>
                            {questions.map((q) => (
                              <TableHead key={q.id} className="min-w-[160px]" title={q.text}>
                                Q{q.number}. {q.text.length > 40 ? q.text.slice(0, 38) + "..." : q.text}
                              </TableHead>
                            ))}
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedRows.map((r, i) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-muted-foreground">{responses.length - (page * PAGE_SIZE + i)}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs">{new Date(r.submitted_at).toLocaleString()}</TableCell>
                              {questions.map((q) => (
                                <TableCell key={q.id} className="max-w-[260px] truncate" title={String(r.answers?.[q.id] ?? "")}>
                                  {r.answers?.[q.id] ?? <span className="text-muted-foreground">-</span>}
                                </TableCell>
                              ))}
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteResponse(r.id)} title="Delete response">
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Page {page + 1} of {pageCount}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {view === "settings" && (
            <Card>
              <CardContent className="pt-5 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="set-open">Accepting responses</Label>
                    <p className="text-xs text-muted-foreground">Turn off to close the form. The link then shows a "no longer accepting responses" page.</p>
                  </div>
                  <Switch id="set-open" checked={isOpen} onCheckedChange={setIsOpen} />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="set-required">Make every question required</Label>
                    <p className="text-xs text-muted-foreground">Applies to responses submitted from now on.</p>
                  </div>
                  <Switch id="set-required" checked={requireAll} onCheckedChange={setRequireAll} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="set-limit">Stop after this many responses</Label>
                    <Input
                      id="set-limit"
                      type="number"
                      min={1}
                      max={responseCap}
                      value={limitText}
                      onChange={(e) => setLimitText(e.target.value)}
                      placeholder={`No limit (your plan allows ${responseCap.toLocaleString()})`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="set-close">Close the form on</Label>
                    <Input id="set-close" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="set-thanks">Message after submitting</Label>
                  <Textarea id="set-thanks" rows={2} value={thankYou} onChange={(e) => setThankYou(e.target.value)} placeholder="Thank you for taking part in this survey." />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save settings
                  </Button>
                  <Button variant="outline" onClick={updateQuestions} disabled={saving}>
                    Update form questions from my current questionnaire
                  </Button>
                  <Button variant="outline" className="text-red-600" onClick={deleteForm}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete form
                  </Button>
                </div>

                <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Questions can only be changed while a form has no responses, so every answer always matches the question it was given for. To
                  change questions after people have answered, publish a new form.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
