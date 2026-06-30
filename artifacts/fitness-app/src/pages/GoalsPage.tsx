import { useState } from "react";
import {
  useListGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Plus, Target, Check, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const { data: goals, isLoading } = useListGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [unit, setUnit] = useState("kg");
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!title.trim()) { setFormError("Title is required"); return; }
    const t = parseFloat(target);
    const c = parseFloat(current);
    if (isNaN(t) || t <= 0) { setFormError("Enter a valid target"); return; }
    if (isNaN(c)) { setFormError("Enter a valid current value"); return; }

    createGoal.mutate(
      { data: { title: title.trim(), targetValue: t, currentValue: c, unit, deadline: deadline || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setShowForm(false);
          setTitle(""); setTarget(""); setCurrent("0"); setUnit("kg"); setDeadline("");
        },
        onError: () => setFormError("Failed to create goal"),
      }
    );
  };

  const toggleComplete = (goalId: number, completed: boolean) => {
    updateGoal.mutate({ id: goalId, data: { completed: !completed } }, { onSuccess: invalidate });
  };

  const handleDelete = (goalId: number) => {
    if (!confirm("Delete this goal?")) return;
    deleteGoal.mutate({ id: goalId }, { onSuccess: invalidate });
  };

  const activeGoals = goals?.filter((g) => !g.completed) ?? [];
  const completedGoals = goals?.filter((g) => g.completed) ?? [];

  return (
    <AppShell
      title="Goals"
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
            <h3 className="font-semibold text-sm text-foreground">New Goal</h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bench Press 100kg"
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Current</label>
                <input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} step="0.1"
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Target</label>
                <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} step="0.1"
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Unit</label>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, reps, km..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Deadline</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
            </div>
            {formError && <p className="text-destructive text-xs">{formError}</p>}
            <button type="submit" disabled={createGoal.isPending}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-60">
              {createGoal.isPending ? "Saving..." : "Create Goal"}
            </button>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : !goals || goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center mb-4">
              <Target size={28} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No goals yet</p>
            <p className="text-sm text-muted-foreground mt-1">Set a goal to stay motivated</p>
          </div>
        ) : (
          <>
            {activeGoals.length > 0 && (
              <div className="space-y-3">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onToggle={toggleComplete} onDelete={handleDelete} />
                ))}
              </div>
            )}
            {completedGoals.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completed</p>
                <div className="space-y-2">
                  {completedGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onToggle={toggleComplete} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function GoalCard({ goal, onToggle, onDelete }: {
  goal: { id: number; title: string; currentValue: number; targetValue: number; unit: string; deadline?: string | null; completed: boolean };
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  return (
    <div className={`bg-card border rounded-2xl p-4 ${goal.completed ? "border-primary/30 opacity-70" : "border-border"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className={`font-semibold text-sm ${goal.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{goal.title}</p>
          {goal.deadline && (
            <p className="text-xs text-muted-foreground mt-0.5">
              By {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button onClick={() => onToggle(goal.id, goal.completed)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              goal.completed ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button onClick={() => onDelete(goal.id)} className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
        <span className="text-xs font-bold text-primary">{pct}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
