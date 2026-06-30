import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateWorkout } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListWorkoutsQueryKey, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }
  return "Failed to save workout. Try again.";
}

export default function NewWorkoutPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createWorkout = useCreateWorkout();

  const today = new Date().toISOString().split("T")[0];
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Workout name is required"); return; }
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur < 1) { setError("Duration must be at least 1 minute"); return; }

    createWorkout.mutate(
      { data: { name: name.trim(), date, durationMinutes: dur, notes: notes.trim() || undefined } },
      {
        onSuccess: (workout) => {
          queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          navigate(`/workouts/${workout.id}`);
        },
        onError: (error) => setError(getErrorMessage(error)),
      }
    );
  };

  return (
    <AppShell>
      <div className="px-5 pt-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/workouts">
            <button className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <h1 className="text-2xl font-bold">Log Workout</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Workout Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day, Leg Day..."
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <Field label="Duration (minutes)">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={1}
              placeholder="60"
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Any PRs?"
              rows={3}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </Field>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={createWorkout.isPending}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {createWorkout.isPending ? "Saving..." : "Save & Add Sets"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
