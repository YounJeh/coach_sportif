import { Link } from "wouter";
import { useGetStatsSummary, useGetProgressChart, useListWorkouts } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Flame, Dumbbell, Calendar, Clock, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useGetStatsSummary();
  const { data: progress } = useGetProgressChart({ weeks: 8 });
  const { data: workouts } = useListWorkouts({ limit: 5, offset: 0 });

  const displayName = user?.email?.split("@")[0] ?? "Athlete";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{greeting},</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">{displayName}</h1>
          </div>
          <button
            onClick={signOut}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground text-xs font-bold uppercase"
          >
            {displayName[0]}
          </button>
        </div>
      </div>

      <div className="px-5 space-y-5 pb-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Dumbbell size={18} className="text-primary" />}
            label="Total Workouts"
            value={summaryLoading ? "—" : summary ? String(summary.totalWorkouts) : "—"}
          />
          <StatCard
            icon={<Flame size={18} className="text-orange-400" />}
            label="Current Streak"
            value={summaryLoading ? "—" : summary ? `${summary.currentStreakDays}d` : "—"}
          />
          <StatCard
            icon={<Calendar size={18} className="text-blue-400" />}
            label="This Week"
            value={summaryLoading ? "—" : summary ? String(summary.workoutsThisWeek) : "—"}
          />
          <StatCard
            icon={<Clock size={18} className="text-purple-400" />}
            label="Avg Duration"
            value={summaryLoading ? "—" : summary ? `${summary.avgDurationMinutes}m` : "—"}
          />
        </div>

        {/* Volume chart */}
        {progress && progress.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Weekly Volume</span>
              <span className="text-xs text-muted-foreground ml-auto">8 weeks</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={progress} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(82 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(82 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "hsl(240 5% 65%)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 3.7% 15.9%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(0 0% 98%)" }}
                  formatter={(v: number) => [`${v} kg`, "Volume"]}
                />
                <Area type="monotone" dataKey="totalVolumeKg" stroke="hsl(82 100% 50%)" strokeWidth={2} fill="url(#volGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent workouts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Recent Workouts</span>
            <Link href="/workouts">
              <span className="text-xs text-primary font-medium">See all</span>
            </Link>
          </div>
          {(!workouts || workouts.length === 0) ? (
            <EmptyWorkouts />
          ) : (
            <div className="space-y-2">
              {workouts.slice(0, 5).map((w) => (
                <Link key={w.id} href={`/workouts/${w.id}`}>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{w.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {w.durationMinutes}m
                      </p>
                    </div>
                    {w.totalVolume != null && w.totalVolume > 0 && (
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2.5 py-1">
                        {Math.round(w.totalVolume)}kg
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <Link href="/workouts/new">
        <button className="fixed bottom-20 right-5 w-14 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40">
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </Link>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyWorkouts() {
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center">
      <Dumbbell size={32} className="text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-semibold text-foreground">No workouts yet</p>
      <p className="text-xs text-muted-foreground mt-1">Tap + to log your first session</p>
    </div>
  );
}
