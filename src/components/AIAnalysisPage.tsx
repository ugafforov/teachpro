
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Brain,
  CalendarRange,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  analyzeInsights,
  askInsights,
  fetchAnalysisHistory,
  fetchTeacherEntitiesForFilters,
  submitAnalysisFeedback,
} from "@/lib/aiAnalysis";
import { getTashkentDate } from "@/lib/utils";
import {
  AnalysisHistoryItem,
  AnalysisScope,
  AnalyzeInsightsResponse,
  InsightModule,
} from "@/types/aiAnalysis";

interface AIAnalysisPageProps {
  role: "teacher" | "admin";
  currentUserId: string;
  teacherId?: string;
}

const ALL_MODULES: InsightModule[] = [
  "summary",
  "risk",
  "anomaly",
  "forecast",
  "what_if",
  "intervention",
];

const moduleLabels: Record<InsightModule, string> = {
  summary: "Xulosa",
  risk: "Xavf",
  anomaly: "Anomaliya",
  forecast: "Prognoz",
  what_if: "What-if",
  intervention: "Intervensiya",
};

const scopeLabels: Record<AnalysisScope, string> = {
  global: "Global",
  group: "Guruh",
  student: "O'quvchi",
  exam: "Imtihon",
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultDateRange = () => {
  const to = getTashkentDate();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    dateFrom: formatIsoDate(from),
    dateTo: formatIsoDate(to),
  };
};

const levelStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const metricTitle = (metric: string) => {
  if (metric === "attendance") return "Davomat";
  if (metric === "exam_score") return "Imtihon bali";
  if (metric === "discipline") return "Intizom";
  return metric;
};

const AIAnalysisPage: React.FC<AIAnalysisPageProps> = ({
  role,
  currentUserId,
  teacherId,
}) => {
  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [scope, setScope] = useState<AnalysisScope>("global");
  const [entityId, setEntityId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [subject, setSubject] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [modules, setModules] = useState<InsightModule[]>(ALL_MODULES);

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeInsightsResponse | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [citations, setCitations] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  const [whatIfAdjustment, setWhatIfAdjustment] = useState<number[]>([10]);

  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<
    Array<{ id: string; name: string; groupName: string }>
  >([]);
  const [exams, setExams] = useState<
    Array<{ id: string; examName: string; examDate: string }>
  >([]);

  const hasEntitySelector = role === "teacher";

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const items = await fetchAnalysisHistory(currentUserId);
      setHistory(items);
    } catch (error) {
      console.error(error);
      const code = (error as { code?: string })?.code ?? "";
      if (!code.includes("permission-denied")) {
        toast.error("AI tarixini yuklashda xatolik yuz berdi");
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (role !== "teacher" || !teacherId) return;

    const loadEntities = async () => {
      try {
        const entities = await fetchTeacherEntitiesForFilters(teacherId);
        setGroups(entities.groups);
        setStudents(entities.students);
        setExams(entities.exams);
      } catch (error) {
        console.error(error);
        toast.error("Filter ma'lumotlarini yuklashda xatolik yuz berdi");
      }
    };

    void loadEntities();
  }, [role, teacherId]);

  useEffect(() => {
    setEntityId("");
  }, [scope]);

  const selectedEntityOptions = useMemo(() => {
    if (scope === "group") {
      return groups.map((item) => ({ id: item.id, label: item.name }));
    }
    if (scope === "student") {
      return students.map((item) => ({
        id: item.id,
        label: item.groupName ? `${item.name} (${item.groupName})` : item.name,
      }));
    }
    if (scope === "exam") {
      return exams.map((item) => ({
        id: item.id,
        label: item.examDate
          ? `${item.examName} - ${item.examDate}`
          : item.examName,
      }));
    }
    return [];
  }, [scope, groups, students, exams]);

  const toggleModule = (module: InsightModule) => {
    setModules((prev) => {
      if (prev.includes(module)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== module);
      }
      return [...prev, module];
    });
  };

  const runAnalysis = async () => {
    if (scope !== "global" && !entityId) {
      toast.error("Scope uchun mos entity tanlanishi kerak");
      return;
    }

    try {
      setLoading(true);
      setAnswer("");
      setCitations([]);

      const response = await analyzeInsights({
        scope,
        entityId: scope === "global" ? undefined : entityId,
        dateFrom,
        dateTo,
        modules,
        forceRefresh,
        locale: "uz",
        subject: subject.trim() ? subject.trim() : undefined,
      });

      setResult(response);
      toast.success(response.status === "cached" ? "Cache javob olindi" : "Yangi AI tahlil tayyor");
      await loadHistory();
    } catch (error: unknown) {
      console.error(error);
      const code = (error as { code?: string })?.code ?? "";
      const message =
        (error as { message?: string })?.message ??
        "AI tahlilni ishga tushirishda xatolik yuz berdi";
      if (code.includes("internal") || message.toLowerCase() === "internal") {
        toast.error(
          "Server funksiyasida xatolik bor. Functions deploy va OpenAI sozlamalarini tekshiring.",
        );
      } else if (code.includes("permission-denied")) {
        toast.error("AI tahlil uchun ruxsat yo'q");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const askFollowUp = async () => {
    if (!result?.runId || !question.trim()) return;

    try {
      setAsking(true);
      const response = await askInsights({ runId: result.runId, question: question.trim() });
      setAnswer(response.answer);
      setCitations(response.citations);
    } catch (error) {
      console.error(error);
      toast.error("Savol yuborishda xatolik yuz berdi");
    } finally {
      setAsking(false);
    }
  };

  const sendFeedback = async (value: "helpful" | "not_helpful") => {
    if (!result?.runId) return;

    try {
      await submitAnalysisFeedback(result.runId, currentUserId, value);
      toast.success("Fikr saqlandi");
    } catch (error) {
      console.error(error);
      toast.error("Fikrni saqlashda xatolik yuz berdi");
    }
  };

  const simulatedImpact = useMemo(() => {
    const base = result?.whatIf[0]?.expectedDeltaPct ?? 0;
    const adjustment = whatIfAdjustment[0] ?? 0;
    return Number((base * (adjustment / 10)).toFixed(2));
  }, [result, whatIfAdjustment]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            AI Tahlil
          </h2>
          <p className="text-muted-foreground text-sm">
            Chuqur insight, risk signallari, prognoz va intervensiya tavsiyalari
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Sparkles className="w-4 h-4 mr-2" />
          Uzbek only
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="w-4 h-4 text-primary" />
            Tahlil sozlamalari
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as AnalysisScope)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scope tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="group">Guruh</SelectItem>
                  <SelectItem value="student">O'quvchi</SelectItem>
                  <SelectItem value="exam">Imtihon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{scope === "global" ? "Entity" : `${scopeLabels[scope]} ID`}</Label>
              {scope === "global" ? (
                <Input value="Global" disabled />
              ) : hasEntitySelector ? (
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedEntityOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder={`${scopeLabels[scope]} ID kiriting`}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Fan (ixtiyoriy)</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Masalan: Matematika"
              />
            </div>

            <div className="space-y-2">
              <Label>Boshlanish</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tugash</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Cache rejimi</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={forceRefresh ? "outline" : "default"}
                  className="flex-1"
                  onClick={() => setForceRefresh(false)}
                >
                  Cache
                </Button>
                <Button
                  type="button"
                  variant={forceRefresh ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setForceRefresh(true)}
                >
                  Yangilash
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Modullar</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((module) => {
                const selected = modules.includes(module);
                return (
                  <Button
                    key={module}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleModule(module)}
                  >
                    {moduleLabels[module]}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={runAnalysis} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Hisoblanmoqda...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  AI tahlilni ishga tushirish
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="w-4 h-4 text-primary" />
            Tahlil tarixi
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tarix yuklanmoqda...
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Hali tahlil mavjud emas
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setResult(item.response);
                    setAnswer("");
                    setCitations([]);
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {scopeLabels[item.scope]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.generatedAt).toLocaleString("uz-UZ")}
                    </span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-3">{item.summary}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {!result ? (
        <Card className="p-8 text-center text-muted-foreground">
          AI tahlil ishga tushirilgach natijalar shu yerda ko'rsatiladi.
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg">Executive summary</h3>
                <p className="text-sm text-muted-foreground mt-1">{result.summary}</p>
              </div>
              <Badge variant="outline">{result.status === "cached" ? "Cached" : "Fresh"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>Model: {result.modelMeta.model}</span>
              <span>Input token: {result.modelMeta.tokensIn}</span>
              <span>Output token: {result.modelMeta.tokensOut}</span>
            </div>
            {result.comparison?.summary && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                {result.comparison.summary}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Risk signallari
              </div>
              <div className="space-y-2">
                {result.riskAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Xavf signallari aniqlanmadi.</p>
                ) : (
                  result.riskAlerts.map((risk) => (
                    <div key={risk.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={levelStyles[risk.level]}>{risk.level.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Ishonch: {(risk.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm">{risk.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Ta'sir doirasi: {risk.affectedCount}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarRange className="w-4 h-4 text-primary" />
                Anomaliyalar
              </div>
              <div className="space-y-2">
                {result.anomalies.map((item) => (
                  <div key={item.metric} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{metricTitle(item.metric)}</span>
                      <span
                        className={
                          item.deltaPct >= 0 ? "text-emerald-600" : "text-red-600"
                        }
                      >
                        {item.deltaPct >= 0 ? "+" : ""}
                        {item.deltaPct.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingUp className="w-4 h-4 text-primary" />
              4 haftalik prognoz
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {result.forecasts.map((forecast) => (
                <div key={forecast.metric} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">{metricTitle(forecast.metric)}</h4>
                    <span className="text-[11px] text-muted-foreground">
                      {(forecast.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecast.points}>
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} width={26} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold">What-if simulyator</h3>
              <p className="text-sm text-muted-foreground">
                Davomat yaxshilanishi sharoitida kutilayotgan ta'sirni tez baholang.
              </p>
              <div className="space-y-3">
                <Label>Davomat o'zgarishi: {whatIfAdjustment[0]}%</Label>
                <Slider
                  min={-20}
                  max={30}
                  step={1}
                  value={whatIfAdjustment}
                  onValueChange={setWhatIfAdjustment}
                />
                <p className="text-sm">
                  Kutilayotgan natija o'zgarishi: <strong>{simulatedImpact}%</strong>
                </p>
              </div>
              <div className="space-y-2">
                {result.whatIf.map((item, idx) => (
                  <div key={`${item.scenario}-${idx}`} className="border border-border rounded-lg p-3">
                    <p className="text-sm font-medium">{item.scenario}</p>
                    <p className="text-xs text-muted-foreground">{item.assumptions}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold">Intervensiya rejasi</h3>
              <div className="space-y-2">
                {result.interventions.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant="outline">P{item.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.steps}</p>
                    <p className="text-xs mt-2">
                      Muddat: {item.dueInDays} kun | Owner: {item.owner}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4 sm:p-5 space-y-3">
            <h3 className="font-semibold">Haftalik action-plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {result.weeklyPlan.map((item) => (
                <div key={item.day} className="border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">{item.day}</p>
                  <p className="text-xs text-muted-foreground">{item.task}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold">
              <MessageSquare className="w-4 h-4 text-primary" />
              AI savol-javob
            </div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Run bo'yicha savolingizni yozing"
              className="min-h-[90px]"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={askFollowUp} disabled={asking || !question.trim()}>
                {asking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  "Savol yuborish"
                )}
              </Button>
              <Button variant="outline" onClick={() => sendFeedback("helpful")}> 
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Foydali
              </Button>
              <Button variant="outline" onClick={() => sendFeedback("not_helpful")}> 
                <XCircle className="w-4 h-4 mr-2" />
                Foydasiz
              </Button>
            </div>

            {answer && (
              <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
                <p className="text-sm">{answer}</p>
                {citations.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Havolalar: {citations.join(", ")}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPage;
