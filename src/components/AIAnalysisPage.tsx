import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatWithProjectInsights } from "@/lib/aiAnalysis";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { ProjectChatMessage } from "@/types/aiAnalysis";

interface AIAnalysisPageProps {
  role: "teacher" | "admin";
  currentUserId: string;
  teacherId?: string;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const buildConversation = useCallback(
    (nextMessages: ChatMessage[]): ProjectChatMessage[] =>
      nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [],
  );

  const sendPrompt = useCallback(
    async (rawPrompt: string) => {
      const trimmedPrompt = rawPrompt.trim();
      if (!trimmedPrompt || sending) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmedPrompt,
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setPrompt("");
      setSending(true);

      try {
        const response = await chatWithProjectInsights(currentUserId, role, {
          prompt: trimmedPrompt,
          conversation: buildConversation(nextMessages),
        });

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.answer,
          },
        ]);
      } catch (error) {
        console.error(error);
        toast.error(
          (error as { message?: string })?.message ??
            "AI javobini olishda xatolik yuz berdi",
        );
      } finally {
        setSending(false);
      }
    },
    [buildConversation, currentUserId, messages, role, sending],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(prompt);
    }
  };

  return (
    <div className="mx-auto flex min-h-[78vh] w-full max-w-[1080px] flex-col px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="relative flex min-h-[78vh] flex-col">
        {messages.length === 0 && (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-2 pb-10 text-center">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="max-w-5xl font-serif text-[clamp(3.1rem,7vw,5.9rem)] leading-[0.96] tracking-[-0.055em] text-foreground">
              TeachPro bilan bugun nimani tahlil qilamiz?
            </h2>
          </div>
        )}

        <div
          ref={viewportRef}
          className={cn(
            "scrollbar-hide flex-1 overflow-y-auto",
            messages.length === 0 ? "min-h-[12px]" : "pt-4",
          )}
        >
          {messages.length > 0 && (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 pb-10 pt-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "fade-in flex",
                    message.role === "assistant" ? "justify-start" : "justify-end",
                  )}
                >
                  {message.role === "assistant" ? (
                    <article className="w-full max-w-3xl">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          TeachPro AI
                        </span>
                      </div>
                      <StructuredAiResponse content={message.content} />
                    </article>
                  ) : (
                    <div className="max-w-2xl rounded-[24px] bg-muted px-5 py-4 text-sm leading-7 text-foreground sm:px-6">
                      {message.content}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="fade-in flex justify-start">
                  <div className="inline-flex items-center gap-3 px-1 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Javob tayyorlanmoqda...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto mt-6 w-full max-w-5xl">
          <PromptComposer
            value={prompt}
            onChange={setPrompt}
            onKeyDown={handleKeyDown}
            onSubmit={() => void sendPrompt(prompt)}
            sending={sending}
            compact={messages.length > 0}
            role={role}
          />
        </div>
      </div>
    </div>
  );
};

type PromptComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  sending: boolean;
  compact?: boolean;
  role: "teacher" | "admin";
};

const PromptComposer: React.FC<PromptComposerProps> = ({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  sending,
  compact = false,
  role,
}) => (
  <div className="rounded-[32px] border border-border/70 bg-card px-5 py-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7">
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={
        role === "admin"
          ? "Guruhlar, o'qituvchilar, davomat yoki imtihonlar haqida so'rang..."
          : "O'quvchilar, guruhlar, davomat yoki imtihonlar haqida so'rang..."
      }
      className={cn(
        "resize-none border-0 bg-transparent px-0 py-0 text-[16px] leading-8 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 sm:text-[17px]",
        compact ? "min-h-[96px]" : "min-h-[176px]",
      )}
    />

    <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
      <p className="text-xs text-muted-foreground">
        Javoblar TeachPro ma'lumotlari bilan shakllantiriladi
      </p>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          onClick={onSubmit}
          disabled={sending || !value.trim()}
          className="h-11 w-11 rounded-full"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpIcon />}
        </Button>
      </div>
    </div>
  </div>
);

const ArrowUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

export default AIAnalysisPage;
