import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAnalysisHistory,
  chatWithProjectInsights,
  deleteAnalysisRun,
} from "@/lib/aiAnalysis";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  SendHorizontal,
  Bot,
  User,
  MoreHorizontal,
  RefreshCw,
  Lightbulb,
  Trash2,
  ClipboardList,
  Clock,
  ShieldCheck,
  BarChart,
  X,
} from "lucide-react";
import {
  AnalysisHistoryItem,
  ProjectChatMessage,
} from "@/types/aiAnalysis";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AIAnalysisPageProps {
  role: "teacher" | "admin";
  currentUserId: string;
  teacherId?: string;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  meta?: {
    runId: string;
    sourceStatus: string;
    sourceSummary?: string;
    generatedAt: string;
    modelMeta?: {
      provider: string;
      model: string;
      tokensIn: number;
      tokensOut: number;
    };
  };
};

type StructuredBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const createMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function isTableLine(line: string) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(row: string[]) {
  return row.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseStructuredBlocks(content: string): StructuredBlock[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: StructuredBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index]?.trim() ?? "";

    if (!currentLine) {
      index += 1;
      continue;
    }

    const headingMatch = currentLine.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (isTableLine(currentLine)) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableLine(lines[index] ?? "")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }

      const rows = tableLines.map(parseTableRow);
      if (rows.length >= 2) {
        const separatorIndex = isSeparatorRow(rows[1]) ? 1 : -1;
        blocks.push({
          type: "table",
          headers: rows[0],
          rows: rows.slice(separatorIndex === 1 ? 2 : 1),
        });
      } else if (rows.length === 1) {
        blocks.push({
          type: "paragraph",
          text: rows[0]?.join(" | ") ?? "",
        });
      }
      continue;
    }

    if (/^[-*]\s+/.test(currentLine) || /^\d+\.\s+/.test(currentLine)) {
      const ordered = /^\d+\.\s+/.test(currentLine);
      const items: string[] = [];

      while (index < lines.length) {
        const line = lines[index]?.trim() ?? "";
        const bulletMatch = ordered
          ? line.match(/^\d+\.\s+(.*)$/)
          : line.match(/^[-*]\s+(.*)$/);

        if (!bulletMatch) break;
        items.push(bulletMatch[1].trim());
        index += 1;
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const line = lines[index]?.trim() ?? "";
      if (
        !line ||
        line.match(/^(#{1,4})\s+/) ||
        isTableLine(line) ||
        /^[-*]\s+/.test(line) ||
        /^\d+\.\s+/.test(line)
      ) {
        break;
      }

      paragraphLines.push(line);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paragraphLines.join(" "),
      });
      continue;
    }

    index += 1;
  }

  return blocks;
}

const StructuredAiResponse: React.FC<{ content: string }> = ({ content }) => {
  const blocks = parseStructuredBlocks(content);

  if (blocks.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground sm:text-[16px]">
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-5 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level <= 2 ? "h3" : "h4";
          return (
            <HeadingTag
              key={`${block.type}-${index}`}
              className={cn(
                "font-semibold tracking-tight text-foreground",
                block.level <= 2 ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
              )}
            >
              {block.text}
            </HeadingTag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={`${block.type}-${index}`}
              className="whitespace-pre-wrap text-[15px] leading-8 text-foreground sm:text-[16px]"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`${block.type}-${index}`}
              className={cn(
                "space-y-2 text-[15px] leading-8 text-foreground sm:text-[16px]",
                block.ordered ? "list-decimal pl-6" : "list-disc pl-6",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <div
            key={`${block.type}-${index}`}
            className="overflow-x-auto rounded-[22px] border border-border/70 bg-card/70"
          >
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  {block.headers.map((header, headerIndex) => (
                    <th
                      key={`${block.type}-${index}-header-${headerIndex}`}
                      className="border-b border-border/70 px-4 py-3 font-medium text-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${block.type}-${index}-row-${rowIndex}`} className="align-top">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${block.type}-${index}-cell-${rowIndex}-${cellIndex}`}
                        className="border-b border-border/50 px-4 py-3 text-muted-foreground last:border-b-0"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

const AIAnalysisPage: React.FC<AIAnalysisPageProps> = ({
  role,
  currentUserId,
  teacherId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    "O'quvchilar reytingi (Top 10)",
    "Imtihon natijalari tahlili",
    "Davomat bo'yicha hisobot",
    "Xavf ostidagi o'quvchilar",
  ];

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const formatRelativeTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "Hozir";
      if (minutes < 60) return `${minutes} daqiqa oldin`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} soat oldin`;
      const days = Math.floor(hours / 24);
      return `${days} kun oldin`;
    } catch {
      return "—";
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);

    try {
      const items = await fetchAnalysisHistory(currentUserId);
      setHistory(items);
    } catch (error) {
      console.error("History load error", error);
      toast.error("Tahlil tarixini olishda xatolik yuz berdi");
    } finally {
      setHistoryLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    // Sahifa ochilganda sidebar avtomatik yopilsin
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const createAssistantMessage = (response: {
    answer: string;
    runId: string;
    sourceStatus: string;
    sourceSummary?: string;
    generatedAt: string;
    modelMeta: { provider: string; model: string; tokensIn: number; tokensOut: number };
  }): ChatMessage => ({
    id: createMessageId(),
    role: "assistant",
    content: response.answer,
    timestamp: Date.now(),
    meta: {
      runId: response.runId,
      sourceStatus: response.sourceStatus,
      sourceSummary: response.sourceSummary,
      generatedAt: response.generatedAt,
      modelMeta: response.modelMeta,
    },
  });

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chatWithProjectInsights(currentUserId, role, {
        prompt: text,
        conversation: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg = createAssistantMessage(response);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setActiveHistoryId(null);
    toast.success("Suhbat tarixi tozalandi");
  };

  const selectHistoryItem = (item: AnalysisHistoryItem) => {
    setActiveHistoryId(item.id);
    setMessages([
      {
        id: createMessageId(),
        role: "assistant",
        content: item.summary,
        timestamp: Date.now(),
        meta: {
          runId: item.id,
          sourceStatus: "saved",
          sourceSummary: item.summary,
          generatedAt: item.generatedAt,
          modelMeta: {
            provider: "—",
            model: "—",
            tokensIn: 0,
            tokensOut: 0,
          },
        },
      },
    ]);
    setSidebarOpen(false);
  };

  const deleteHistoryItem = async (runId: string) => {
    const confirmed = window.confirm("Haqiqatan ham ushbu tahlilni o'chirmoqchimisiz?");
    if (!confirmed) return;

    try {
      await deleteAnalysisRun(runId);
      setHistory((prev) => prev.filter((item) => item.id !== runId));
      if (activeHistoryId === runId) {
        setActiveHistoryId(null);
        setMessages([]);
      }
      toast.success("Tahlil muvaffaqiyatli o'chirildi");
    } catch (error) {
      console.error("Delete history error", error);
      toast.error("Tahlilni o'chirishda xatolik yuz berdi");
    }
  };

  const handleQuickAction = (text: string) => {
    setSidebarOpen(false);
    handleSend(text);
  };

  const activeHistoryItem = history.find((item) => item.id === activeHistoryId);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-background/50 rounded-xl overflow-hidden border shadow-sm backdrop-blur-sm">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / History */}
        <aside
          className={cn(
            "flex flex-col w-80 shrink-0 border-r border-border bg-card/70 backdrop-blur-lg",
            "transition-all duration-300",
            sidebarOpen ? "flex lg:flex" : "hidden lg:hidden",
          )}
        >
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">AI tahlil</p>
                <p className="text-xs text-muted-foreground">Tezkor harakatlar va o'tgan runlar</p>
              </div>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Premium
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tezkor buyruqlar
              </p>
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleQuickAction(action)}
                    className="flex items-center gap-2 px-3 py-2 text-left text-sm font-medium rounded-xl bg-card/80 border border-border hover:bg-primary/10 hover:border-primary/30 transition"
                  >
                    <Lightbulb className="w-4 h-4 text-indigo-500" />
                    <span className="truncate">{action}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  So'nggi tahlillar
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {history.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {historyLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="rounded-xl bg-card/70 border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Hech qanday tahlil topilmadi. Birinchi so'rovingizni boshlang.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectHistoryItem(item)}
                        className={cn(
                          "w-full flex flex-col items-start gap-1 p-3 rounded-xl border shadow-sm transition",
                          activeHistoryId === item.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card/70 hover:bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {item.scope === "global" ? "Global" : item.scope === "group" ? "Guruh" : item.scope === "student" ? "O'quvchi" : "Imtihon"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(item.generatedAt)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteHistoryItem(item.id);
                              }}
                              className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
                              aria-label="Tahlilni o'chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[12px] text-muted-foreground line-clamp-2">
                          {item.summary}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              AI tahlil natijalari avtomatik saqlanadi va 30 kun saqlanadi.
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          {/* Header - Modern & Clean */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-foreground/90">TeachPro AI</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-xs font-medium text-muted-foreground">Online Assistant</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="rounded-full hover:bg-muted/80 text-muted-foreground transition-colors"
                aria-label={sidebarOpen ? "Tahlil tarixini yopish" : "Tahlil tarixini ochish"}
              >
                {sidebarOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <ClipboardList className="w-5 h-5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/80 text-muted-foreground transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1">
                  <DropdownMenuItem onClick={clearChat} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-md">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Tarixni tozalash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Chat Area - Modern Cards */}
          <ScrollArea className="flex-1 px-4 sm:px-6 bg-slate-50/50 dark:bg-background/20">
            <div className="max-w-3xl mx-auto py-8 space-y-8">
              {messages.length === 0 && (
                <div className="text-center py-12 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-inset ring-indigo-500/20">
                    <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground/90 mb-3 tracking-tight">Qanday yordam bera olaman?</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-10 text-sm leading-relaxed">
                    O'quvchilar tahlili, guruhlar statistikasi va davomat bo'yicha sun'iy intellekt yordamchisi.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                    {quickActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(action)}
                        className="group flex items-center gap-3 p-4 text-sm text-left bg-card hover:bg-accent/50 border hover:border-indigo-500/30 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
                      >
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors text-indigo-600 dark:text-indigo-400">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground/80 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{action}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-4 max-w-3xl group animate-in slide-in-from-bottom-2 fade-in duration-300",
                    msg.role === "user" ? "justify-end pl-12" : "justify-start pr-12"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex flex-col gap-1.5 min-w-0",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-5 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-[20px] rounded-tr-sm"
                          : "bg-card border rounded-[20px] rounded-tl-sm text-foreground"
                      )}
                    >
                      {msg.role === "assistant" ? (
                         <StructuredAiResponse content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>

                    {msg.meta && (
                      <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted-foreground/80 px-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(msg.meta.generatedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {msg.meta.sourceStatus}
                        </span>
                        {msg.meta.modelMeta && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1">
                            <BarChart className="w-3.5 h-3.5" />
                            {msg.meta.modelMeta.model}
                          </span>
                        )}
                        {msg.meta.modelMeta && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1">
                            <ClipboardList className="w-3.5 h-3.5" />
                            {msg.meta.modelMeta.tokensIn}+ in • {msg.meta.modelMeta.tokensOut}+ out
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-[11px] font-medium text-muted-foreground/50 px-2 select-none">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4 max-w-3xl animate-in fade-in">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm opacity-80">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 bg-card border px-4 py-3 rounded-[20px] rounded-tl-sm shadow-sm h-[46px]">
                    <span className="w-2 h-2 bg-indigo-500/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-indigo-500/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-indigo-500/60 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input Area - Modern & Polished */}
          <div className="p-4 bg-background/80 backdrop-blur-sm border-t sticky bottom-0 z-10">
            <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-card p-2 rounded-2xl border shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all duration-300">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="AI assistantga savol yozing..."
                className="min-h-[44px] max-h-[150px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 px-4 py-2.5 text-[15px] placeholder:text-muted-foreground/60 shadow-none"
                rows={1}
              />
              <Button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isLoading}
                size="icon"
                className={cn(
                  "h-9 w-9 mb-0.5 shrink-0 rounded-xl transition-all duration-300 shadow-sm",
                  input.trim()
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95 shadow-indigo-500/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <SendHorizontal className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground/50 mt-3 font-medium tracking-wide">
              AI javoblari xato bo'lishi mumkin. Muhim ma'lumotlarni tekshiring.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile history drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-11/12 max-w-xs bg-card/90 border-l border-border shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Tahlil tarixi</p>
                <p className="text-xs text-muted-foreground">Oxirgi runlar</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                aria-label="Yopish"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-72px)]">
              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl bg-card/70 border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Hech qanday tahlil topilmadi.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectHistoryItem(item)}
                      className={cn(
                        "w-full flex flex-col items-start gap-1 p-3 rounded-xl border shadow-sm transition",
                        activeHistoryId === item.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card/70 hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item.scope === "global" ? "Global" : item.scope === "group" ? "Guruh" : item.scope === "student" ? "O'quvchi" : "Imtihon"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(item.generatedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                            className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
                            aria-label="Tahlilni o'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[12px] text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPage;
