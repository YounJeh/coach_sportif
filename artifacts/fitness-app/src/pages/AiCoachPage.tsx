import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import {
  useAskCoach,
  useListWorkouts,
  useSaveCoachPlan,
  getListPlanningSessionsQueryKey,
  type CoachPlannedSessionPreview,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Bot, CalendarDays, CheckCircle2, Clock3, Dumbbell, Save, Send, User, X } from "lucide-react";

type PlanCardState = "idle" | "saving" | "saved" | "dismissed" | "error";

type TextMessage = {
  id: number;
  role: "user" | "assistant";
  kind: "text";
  content: string;
};

type PlanPreviewMessage = {
  id: number;
  role: "assistant";
  kind: "plan-preview";
  sessions: CoachPlannedSessionPreview[];
  state: PlanCardState;
  error: string | null;
};

type Message = TextMessage | PlanPreviewMessage;

const modalityStyles: Record<string, { label: string; color: string }> = {
  running: { label: "Running", color: "bg-sky-500/15 text-sky-600" },
  strength: { label: "Strength", color: "bg-rose-500/15 text-rose-600" },
  fitness: { label: "Fitness", color: "bg-violet-500/15 text-violet-600" },
  recovery: { label: "Recovery", color: "bg-emerald-500/15 text-emerald-600" },
};

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function groupSessionsByDate(sessions: CoachPlannedSessionPreview[]): Array<[string, CoachPlannedSessionPreview[]]> {
  const map = new Map<string, CoachPlannedSessionPreview[]>();
  for (const session of sessions) {
    const key = session.sessionDate;
    const list = map.get(key) ?? [];
    list.push(session);
    map.set(key, list);
  }

  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function MessageBubble({
  message,
  onSavePlan,
  onDismissPlan,
}: {
  message: Message;
  onSavePlan: (id: number, sessions: CoachPlannedSessionPreview[]) => void;
  onDismissPlan: (id: number) => void;
}) {
  if (message.kind === "text") {
    return (
      <div className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        {message.role === "assistant" && (
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={16} className="text-primary-foreground" />
          </div>
        )}
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            message.role === "user"
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border text-foreground rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>
        {message.role === "user" && (
          <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5">
            <User size={16} className="text-foreground" />
          </div>
        )}
      </div>
    );
  }

  const grouped = groupSessionsByDate(message.sessions);

  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={16} className="text-primary-foreground" />
      </div>

      <div className="max-w-[88%] rounded-2xl rounded-tl-sm p-[1px] bg-gradient-to-br from-primary/35 via-border to-emerald-500/40 shadow-sm">
        <div className="rounded-[15px] bg-card/95 backdrop-blur px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-primary/80">AI Planning Preview</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {message.sessions.length} session{message.sessions.length > 1 ? "s" : ""} ready to save
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays size={15} />
            </div>
          </div>

          <div className="space-y-3">
            {grouped.map(([date, sessions]) => (
              <section key={date} className="rounded-xl border border-border bg-background/80 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {formatDateLabel(date)}
                </p>
                <div className="space-y-2">
                  {sessions.map((session, idx) => {
                    const style = modalityStyles[session.modality] ?? modalityStyles.fitness;
                    return (
                      <div key={`${session.sessionDate}-${session.title}-${idx}`} className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${style.color}`}>
                                {style.label}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock3 size={12} /> {session.targetDurationMin} min
                              </span>
                              {session.targetIntensityRpe != null && (
                                <span className="text-xs text-muted-foreground">RPE {session.targetIntensityRpe}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {session.notes && <p className="text-xs text-muted-foreground mt-2">{session.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {message.state === "saved" && (
            <div className="mt-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 font-medium flex items-center gap-2">
              <CheckCircle2 size={14} /> Planning saved. You can find it in the Planning tab.
            </div>
          )}

          {message.state === "dismissed" && (
            <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              Preview dismissed. Nothing has been saved.
            </div>
          )}

          {message.error && (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {message.error}
            </div>
          )}

          {(message.state === "idle" || message.state === "saving" || message.state === "error") && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => onSavePlan(message.id, message.sessions)}
                disabled={message.state === "saving"}
                className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Save size={14} /> {message.state === "saving" ? "Saving..." : "Save to Planning"}
              </button>
              <button
                onClick={() => onDismissPlan(message.id)}
                disabled={message.state === "saving"}
                className="h-10 rounded-xl border border-border bg-background text-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <X size={14} /> Skip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiCoachPage() {
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preloadWorkoutId = params.get("workoutId") ? parseInt(params.get("workoutId")!, 10) : null;

  const { data: workouts } = useListWorkouts({ limit: 20, offset: 0 });
  const askCoach = useAskCoach();
  const saveCoachPlan = useSaveCoachPlan();
  const messageId = useRef(0);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      kind: "text",
      content: "Hey! I'm your AI training coach. Ask me anything about your workouts — recovery tips, form advice, programming suggestions, or feedback on a specific session.",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(preloadWorkoutId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageId.current = 1;
  }, []);

  const nextMessageId = () => {
    messageId.current += 1;
    return messageId.current;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setPlanMessageState = (id: number, state: PlanCardState, error: string | null = null) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id || msg.kind !== "plan-preview") {
          return msg;
        }

        return { ...msg, state, error };
      }),
    );
  };

  const handleSavePlan = (id: number, sessions: CoachPlannedSessionPreview[]) => {
    setPlanMessageState(id, "saving", null);

    saveCoachPlan.mutate(
      { data: { sessions } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlanningSessionsQueryKey() });
          setPlanMessageState(id, "saved", null);
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Could not save this planning preview.";
          setPlanMessageState(id, "error", message);
        },
      },
    );
  };

  const handleDismissPlan = (id: number) => {
    setPlanMessageState(id, "dismissed", null);
  };

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", kind: "text", content: msg }]);
    setInput("");

    askCoach.mutate(
      { data: { message: msg, workoutId: selectedWorkoutId ?? null } },
      {
        onSuccess: (data) => {
          setMessages((prev) => {
            const next = [...prev];
            if (data.briefingAthlete) {
              next.push({ id: nextMessageId(), role: "assistant", kind: "text", content: data.briefingAthlete });
            }
            next.push({ id: nextMessageId(), role: "assistant", kind: "text", content: data.reply });
            if (data.planPreview && data.planPreview.length > 0) {
              next.push({
                id: nextMessageId(),
                role: "assistant",
                kind: "plan-preview",
                sessions: data.planPreview,
                state: "idle",
                error: null,
              });
            }
            return next;
          });
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: "assistant",
              kind: "text",
              content: "Sorry, I couldn't get a response. Please try again.",
            },
          ]);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AppShell title="AI Coach">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Workout selector */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
            <Dumbbell size={14} className="text-muted-foreground shrink-0" />
            <select
              value={selectedWorkoutId ?? ""}
              onChange={(e) => setSelectedWorkoutId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
            >
              <option value="">No specific workout</option>
              {workouts?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onSavePlan={handleSavePlan} onDismissPlan={handleDismissPlan} />
          ))}
          {askCoach.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Bot size={16} className="text-primary-foreground" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-4">
          <div className="flex gap-2 bg-card border border-border rounded-2xl p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach anything..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none px-2 py-1.5"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || askCoach.isPending}
              className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
