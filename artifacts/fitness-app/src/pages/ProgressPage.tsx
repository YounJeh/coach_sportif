import { useGetProgressChart, useGetPersonalRecords } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Trophy } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function ProgressPage() {
  const { data: progress, isLoading: progressLoading } = useGetProgressChart({ weeks: 8 });
  const { data: prs, isLoading: prsLoading } = useGetPersonalRecords();

  return (
    <AppShell title="Progress">
      <div className="px-5 space-y-6">
        {/* Volume chart */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm text-foreground mb-1">Weekly Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">Total weight lifted per week (kg)</p>
          {progressLoading ? (
            <div className="h-40 animate-pulse bg-secondary rounded-xl" />
          ) : !progress || progress.every((p) => p.totalVolumeKg === 0) ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Log workouts to see your progress
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={progress} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 3.7% 15.9%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(0 0% 98%)" }}
                  formatter={(v: number) => [`${v} kg`, "Volume"]}
                />
                <Line
                  type="monotone"
                  dataKey="totalVolumeKg"
                  stroke="hsl(82 100% 50%)"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(82 100% 50%)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "hsl(82 100% 50%)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Workout count chart */}
        {progress && progress.some((p) => p.workoutCount > 0) && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm text-foreground mb-1">Workouts per Week</h3>
            <p className="text-xs text-muted-foreground mb-4">Training frequency</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={progress} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 3.7% 15.9%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(0 0% 98%)" }}
                  formatter={(v: number) => [v, "Workouts"]}
                />
                <Line type="monotone" dataKey="workoutCount" stroke="hsl(173 58% 39%)" strokeWidth={2} dot={{ fill: "hsl(173 58% 39%)", r: 3, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Personal Records */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-yellow-400" />
            <h3 className="font-semibold text-sm text-foreground">Personal Records</h3>
          </div>
          {prsLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          ) : !prs || prs.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center">
              <Trophy size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Log sets to see your PRs</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 px-4 py-2 bg-secondary/30 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exercise</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Max Weight</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Date</span>
              </div>
              <div className="divide-y divide-border">
                {prs.map((pr) => (
                  <div key={pr.exerciseId} className="grid grid-cols-3 px-4 py-3 items-center">
                    <span className="text-sm font-medium text-foreground">{pr.exerciseName}</span>
                    <span className="text-sm font-bold text-primary text-center">{pr.maxWeightKg}kg</span>
                    <span className="text-xs text-muted-foreground text-right">
                      {new Date(pr.achievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
