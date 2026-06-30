import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useAskCoach, useListWorkouts } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Send, Bot, User, Dumbbell } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiCoachPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preloadWorkoutId = params.get("workoutId") ? parseInt(params.get("workoutId")!, 10) : null;

  const { data: workouts } = useListWorkouts({ limit: 20, offset: 0 });
  const askCoach = useAskCoach();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I'm your AI training coach. Ask me anything about your workouts — recovery tips, form advice, programming suggestions, or feedback on a specific session.",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(preloadWorkoutId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");

    askCoach.mutate(
      { data: { message: msg, workoutId: selectedWorkoutId ?? null } },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I couldn't get a response. Please try again." },
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
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={16} className="text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User size={16} className="text-foreground" />
                </div>
              )}
            </div>
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
