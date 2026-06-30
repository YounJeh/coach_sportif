import { Link } from "wouter";
import { useListWorkouts } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Plus, Dumbbell, ChevronRight } from "lucide-react";

export default function WorkoutsPage() {
  const { data: workouts, isLoading } = useListWorkouts({ limit: 50, offset: 0 });

  return (
    <AppShell
      title="Workout History"
      action={
        <Link href="/workouts/new">
          <button className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center">
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </Link>
      }
    >
      <div className="px-5">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !workouts || workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center mb-4">
              <Dumbbell size={28} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No workouts logged</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Start tracking your training sessions</p>
            <Link href="/workouts/new">
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm">
                Log First Workout
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            {workouts.map((w) => (
              <Link key={w.id} href={`/workouts/${w.id}`}>
                <div className="bg-card border border-border rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Dumbbell size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{w.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(w.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {w.durationMinutes}m
                        {w.totalVolume != null && w.totalVolume > 0 && ` · ${Math.round(w.totalVolume)}kg`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
