import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { logError } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatWithProjectInsights, analyzeInsights } from "@/lib/aiAnalysis";
import { callGeminiDirect } from "@/lib/geminiDirect";
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
} from "lucide-react";
import { ProjectChatMessage } from "@/types/aiAnalysis";
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
  const [hasAnalysis, setHasAnalysis] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      let answer: string;

      // Try Firebase Functions first
      try {
        const response = await chatWithProjectInsights(currentUserId, role, {
          prompt: text,
          conversation: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });
        answer = response.answer;
      } catch (firebaseError) {
        // Fallback to direct API call if Firebase Functions fail
        const conversationHistory = messages.map(m => `${m.role === 'user' ? 'Foydalanuvchi' : 'AI'}: ${m.content}`).join('\n');
        const prompt = `Suhbat tarixi:\n${conversationHistory}\n\nSavol: ${text}\n\nO'zbek tilida javob bering.`;
        answer = await callGeminiDirect(prompt);
      }

      const assistantMsg: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: answer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      logError("AIAnalysisPage.chat", error);
      toast.error("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success("Suhbat tarixi tozalandi");
  };

  const runInitialAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Try Firebase Functions first
      try {
        await analyzeInsights(currentUserId, role, {
          scope: "global",
          dateFrom: thirtyDaysAgo.toISOString().split('T')[0],
          dateTo: today.toISOString().split('T')[0],
          modules: ["summary", "risk", "anomaly", "forecast", "what_if", "intervention"],
          locale: "uz",
        });
      } catch (firebaseError) {
        // Fallback to direct API call if Firebase Functions fail
        const prompt = "O'quvchilar tahlili uchun qisqacha xulola bering. Davomat, imtihon natijalari va xavf belgilarini hisobga oling.";
        await callGeminiDirect(prompt);
      }

      setHasAnalysis(true);
      toast.success("Tahlil muvaffaqiyatli yakunlandi");
    } catch (error) {
      logError("AIAnalysisPage.runInitialAnalysis", error);
      toast.error("Tahlilni bajarishda xatolik yuz berdi");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      {/* Header - Minimalist */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-background" />
          </div>
          <h2 className="font-semibold text-foreground">AI Yordamchi</h2>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={clearChat} className="cursor-pointer">
              <Trash2 className="w-4 h-4 mr-2" />
              Tozalash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chat Area - Minimalist */}
      <ScrollArea className="flex-1 px-4">
        <div className="max-w-2xl mx-auto py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-foreground mb-2">Qanday yordam bera olaman?</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                O'quvchilar tahlili, guruhlar statistikasi va davomat bo'yicha savollar bering.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(action)}
                    className="text-sm text-left px-4 py-3 bg-muted/50 hover:bg-muted border rounded-lg transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-2xl",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-background" />
                </div>
              )}

              <div
                className={cn(
                  "px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-2xl rounded-tr-sm"
                    : "bg-muted text-foreground rounded-2xl rounded-tl-sm"
                )}
              >
                {msg.role === "assistant" ? (
                  <StructuredAiResponse content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 max-w-2xl">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-background" />
              </div>
              <div className="flex items-center gap-1 bg-muted px-4 py-2.5 rounded-2xl">
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area - Minimalist */}
      <div className="p-4 border-t bg-background">
        <div className="max-w-2xl mx-auto flex items-end gap-2 bg-muted/50 p-2 rounded-xl border focus-within:border-foreground/50 transition-colors">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Savol yozing..."
            className="min-h-[44px] max-h-[120px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 px-3 py-2 text-sm placeholder:text-muted-foreground/60 shadow-none"
            rows={1}
          />
          <Button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg transition-all",
              input.trim() 
                ? "bg-foreground text-background hover:opacity-90" 
                : "bg-muted text-muted-foreground"
            )}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizontal className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default AIAnalysisPage;
