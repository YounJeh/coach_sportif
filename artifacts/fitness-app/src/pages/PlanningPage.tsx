import { useMemo, useState } from "react";
import {
  useListPlanningSessions,
  useCreatePlanningSession,
  useUpdatePlanningSession,
  useDeletePlanningSession,
  getListPlanningSessionsQueryKey,
  type PlanningSession,
  type PlanningSessionInputModality,
  type PlanningSessionStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarDays, Clock3, Plus, Trash2, X } from "lucide-react";

const modalities: Array<{ value: PlanningSessionInputModality; label: string }> = [
  { value: "running", label: "Running" },
  { value: "strength", label: "Strength" },
  { value: "fitness", label: "Fitness" },
  { value: "recovery", label: "Recovery" },
];

const statuses: PlanningSessionStatus[] = ["planned", "done", "skipped", "adapted"];

function nextStatus(current: PlanningSessionStatus): PlanningSessionStatus {
  const idx = statuses.indexOf(current);
  return statuses[(idx + 1) % statuses.length];
}

function statusColor(status: PlanningSessionStatus): string {
  if (status === "done") return "text-emerald-500";
  if (status === "skipped") return "text-destructive";
  if (status === "adapted") return "text-amber-500";
  return "text-primary";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function PlanningPage() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useListPlanningSessions();
  const createSession = useCreatePlanningSession();
  const updateSession = useUpdatePlanningSession();
  const deleteSession = useDeletePlanningSession();

  const [showForm, setShowForm] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [modality, setModality] = useState<PlanningSessionInputModality>("fitness");
  const [targetDurationMin, setTargetDurationMin] = useState("45");
  const [targetIntensityRpe, setTargetIntensityRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListPlanningSessionsQueryKey() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const duration = parseInt(targetDurationMin, 10);
    const intensity = targetIntensityRpe.trim() ? parseFloat(targetIntensityRpe) : undefined;

    if (!title.trim()) {
      setFormError("Title is required");
      return;
    }
    if (Number.isNaN(duration) || duration <= 0) {
      setFormError("Duration must be a positive number");
      return;
    }
    if (intensity != null && (Number.isNaN(intensity) || intensity < 1 || intensity > 10)) {
      setFormError("RPE must be between 1 and 10");
      return;
    }

    createSession.mutate(
      {
        data: {
          sessionDate,
          modality,
          title: title.trim(),
          targetDurationMin: duration,
          targetIntensityRpe: intensity,
          notes: notes.trim() || undefined,
          status: "planned",
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setShowForm(false);
          setTitle("");
          setTargetDurationMin("45");
          setTargetIntensityRpe("");
          setNotes("");
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Failed to create session";
          setFormError(message);
        },
      },
    );
  };

  const handleStatusCycle = (session: PlanningSession) => {
    updateSession.mutate({ id: session.id, data: { status: nextStatus(session.status) } }, { onSuccess: invalidate });
  };

  const handleDelete = (sessionId: number) => {
    if (!confirm("Delete this session?")) return;
    deleteSession.mutate({ id: sessionId }, { onSuccess: invalidate });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlanningSession[]>();
    for (const session of sessions ?? []) {
      const key = session.sessionDate;
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  return (
    <AppShell
      title="Planning"
      action={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center"
        >
          {showForm ? <X size={18} /> : <Plus size={18} strokeWidth={2.5} />}
        </button>
      }
    >
      <div className="px-5 space-y-4">
        {showForm && (
          <form onSubmit={handleCreate} className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <h3 className="font-semibold text-sm text-foreground">New Session</h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Easy run, Full body A"
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Modality</label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as PlanningSessionInputModality)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                >
                  {modalities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  value={targetDurationMin}
                  onChange={(e) => setTargetDurationMin(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Target RPE (optional)</label>
              <input
                type="number"
                min={1}
                max={10}
                step="0.5"
                value={targetIntensityRpe}
                onChange={(e) => setTargetIntensityRpe(e.target.value)}
                placeholder="1 to 10"
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Context, objective, constraints..."
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
              />
            </div>

            {formError && <p className="text-destructive text-xs">{formError}</p>}
            <button
              type="submit"
              disabled={createSession.isPending}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-60"
            >
              {createSession.isPending ? "Saving..." : "Create Session"}
            </button>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center mb-4">
              <CalendarDays size={28} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No session planned yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first session to build your week</p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {grouped.map(([dateKey, daySessions]) => (
              <section key={dateKey} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{formatDate(dateKey)}</p>
                <div className="space-y-2">
                  {daySessions.map((session) => (
                    <article key={session.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{session.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wide">
                              {session.modality}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock3 size={12} /> {session.targetDurationMin} min
                            </span>
                            {session.targetIntensityRpe != null && (
                              <span className="text-xs text-muted-foreground">RPE {session.targetIntensityRpe}</span>
                            )}
                          </div>
                          {session.notes && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{session.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStatusCycle(session)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary ${statusColor(session.status)}`}
                            title="Cycle status"
                          >
                            {session.status}
                          </button>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}