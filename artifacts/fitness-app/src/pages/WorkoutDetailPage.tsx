import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetWorkout,
  useListWorkoutSets,
  useAddWorkoutSet,
  useDeleteWorkout,
  useListExercises,
  getListWorkoutsQueryKey,
  getGetWorkoutQueryKey,
  getListWorkoutSetsQueryKey,
  getGetStatsSummaryQueryKey,
} from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { ArrowLeft, Trash2, Plus, Bot } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function WorkoutDetailPage() {
  const [, params] = useRoute("/workouts/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id ?? "0", 10);
  const queryClient = useQueryClient();

  const { data: workout, isLoading } = useGetWorkout(id);
  const { data: sets } = useListWorkoutSets(id);
  const { data: exercises } = useListExercises();
  const addSet = useAddWorkoutSet();
  const deleteWorkout = useDeleteWorkout();

  const [showAddSet, setShowAddSet] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [setError, setSetError] = useState("");

  const groupedSets = (sets ?? []).reduce<Record<string, typeof sets>>((acc, s) => {
    if (!s) return acc;
    const key = s.exerciseName;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(s);
    return acc;
  }, {});

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    setSetError("");
    const eId = parseInt(exerciseId, 10);
    if (!eId) { setSetError("Select an exercise"); return; }
    const repsNum = parseInt(reps, 10);
    const weightNum = parseFloat(weight);
    if (isNaN(repsNum) || repsNum < 1) { setSetError("Enter valid reps"); return; }
    if (isNaN(weightNum) || weightNum < 0) { setSetError("Enter valid weight"); return; }

    const currentSets = sets?.filter((s) => s.exerciseId === eId) ?? [];
    const setNumber = currentSets.length + 1;

    addSet.mutate(
      { id, data: { exerciseId: eId, setNumber, reps: repsNum, weightKg: weightNum } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkoutSetsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(id) });
          setReps("10");
          setWeight("0");
        },
        onError: () => setSetError("Failed to add set"),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this workout?")) return;
    deleteWorkout.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          navigate("/workouts");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="px-5 pt-12 space-y-4">
          <div className="h-8 w-48 bg-card rounded-xl animate-pulse" />
          <div className="h-24 bg-card rounded-2xl animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (!workout) {
    return (
      <AppShell>
        <div className="px-5 pt-12 text-center">
          <p className="text-muted-foreground">Workout not found</p>
          <Link href="/workouts"><button className="text-primary text-sm mt-4">Back to history</button></Link>
        </div>
      </AppShell>
    );
  }

  const totalVolume = (sets ?? []).reduce((sum, s) => sum + s.reps * Number(s.weightKg), 0);

  return (
    <AppShell>
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/workouts">
              <button className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center">
                <ArrowLeft size={18} />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{workout.name}</h1>
              <p className="text-xs text-muted-foreground">
                {new Date(workout.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={handleDelete} className="w-9 h-9 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
            <Trash2 size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <MiniStat label="Duration" value={`${workout.durationMinutes}m`} />
          <MiniStat label="Sets" value={String(sets?.length ?? 0)} />
          <MiniStat label="Volume" value={totalVolume > 0 ? `${Math.round(totalVolume)}kg` : "—"} />
        </div>

        {workout.notes && (
          <div className="bg-card border border-border rounded-xl px-4 py-3 mb-5 text-sm text-muted-foreground italic">
            "{workout.notes}"
          </div>
        )}

        {/* Sets */}
        {Object.keys(groupedSets).length > 0 && (
          <div className="space-y-4 mb-5">
            {Object.entries(groupedSets).map(([exerciseName, exSets]) => (
              <div key={exerciseName} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <p className="font-semibold text-sm text-foreground">{exerciseName}</p>
                </div>
                <div className="divide-y divide-border">
                  {exSets?.map((s) => (
                    <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Set {s.setNumber}</span>
                      <span className="text-sm font-semibold text-foreground">{s.reps} × {Number(s.weightKg)}kg</span>
                      <span className="text-xs text-primary font-bold">{Math.round(s.reps * Number(s.weightKg))}kg total</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Set */}
        <button
          onClick={() => setShowAddSet((s) => !s)}
          className="w-full bg-primary/10 border border-primary/30 text-primary rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 mb-4"
        >
          <Plus size={18} />
          Add Set
        </button>

        {showAddSet && (
          <form onSubmit={handleAddSet} className="bg-card border border-border rounded-2xl p-4 space-y-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Exercise</label>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Select exercise...</option>
                {exercises?.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name} ({ex.muscleGroup})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Reps</label>
                <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} min={1}
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Weight (kg)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min={0} step={0.5}
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              </div>
            </div>
            {setError && <p className="text-destructive text-xs">{setError}</p>}
            <button type="submit" disabled={addSet.isPending}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-60">
              {addSet.isPending ? "Adding..." : "Add Set"}
            </button>
          </form>
        )}

        {/* AI Coach link */}
        <Link href={`/ai-coach?workoutId=${workout.id}`}>
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-4 active:scale-[0.99] transition-transform">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ask AI Coach</p>
              <p className="text-xs text-muted-foreground">Get feedback on this workout</p>
            </div>
          </div>
        </Link>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary rounded-xl px-3 py-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">{label}</p>
    </div>
  );
}
