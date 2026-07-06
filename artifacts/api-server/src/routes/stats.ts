import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { db, workoutsTable, workoutSetsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { type Request } from "express";

const router: IRouter = Router();

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

router.get("/stats/summary", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const workouts = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.userId, userId))
    .orderBy(desc(workoutsTable.date));

  const totalWorkouts = workouts.length;

  const allSets = totalWorkouts > 0
    ? await db
        .select()
        .from(workoutSetsTable)
        .where(
          sql`${workoutSetsTable.workoutId} IN (SELECT id FROM workouts WHERE user_id = ${userId})`,
        )
    : [];

  const totalVolumeKg = allSets.reduce(
    (sum, s) => sum + s.reps * Number(s.weightKg),
    0,
  );

  const avgDurationMinutes =
    totalWorkouts > 0
      ? workouts.reduce((sum, w) => sum + w.durationMinutes, 0) / totalWorkouts
      : 0;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const workoutsThisWeek = workouts.filter(
    (w) => new Date(w.date) >= startOfWeek,
  ).length;

  let currentStreakDays = 0;
  const sortedDates = workouts
    .map((w) => w.date)
    .sort()
    .reverse();

  if (sortedDates.length > 0) {
    const uniqueDates = [...new Set(sortedDates)];
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (const dateStr of uniqueDates) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((checkDate.getTime() - d.getTime()) / 86400000);
      if (diff <= 1) {
        streak++;
        checkDate = d;
      } else {
        break;
      }
    }
    currentStreakDays = streak;
  }

  let longestStreakDays = 0;
  const uniqueDates = [...new Set(sortedDates)].sort();
  if (uniqueDates.length > 0) {
    let streak = 1;
    let maxStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diff = Math.round(
        (curr.getTime() - prev.getTime()) / 86400000,
      );
      if (diff === 1) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 1;
      }
    }
    longestStreakDays = maxStreak;
  }

  res.json({
    totalWorkouts,
    totalVolumeKg: Math.round(totalVolumeKg),
    currentStreakDays,
    longestStreakDays,
    workoutsThisWeek,
    avgDurationMinutes: Math.round(avgDurationMinutes),
  });
});

router.get("/stats/progress", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawWeeks = parseInt(String(req.query.weeks ?? "8"), 10) || 8;
  const weeks = Math.min(Math.max(rawWeeks, 1), 52);

  const points: Array<{ week: string; totalVolumeKg: number; workoutCount: number }> = [];
  const buckets: Array<{ start: string; end: string; label: string }> = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    buckets.push({
      start: formatDateOnly(weekStart),
      end: formatDateOnly(weekEnd),
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    });
  }

  const oldestWeekStart = buckets[0]?.start;
  const latestWeekEnd = buckets[buckets.length - 1]?.end;

  if (!oldestWeekStart || !latestWeekEnd) {
    res.json(points);
    return;
  }

  const workouts = await db
    .select({ id: workoutsTable.id, date: workoutsTable.date })
    .from(workoutsTable)
    .where(
      and(
        eq(workoutsTable.userId, userId),
        gte(workoutsTable.date, oldestWeekStart),
        lte(workoutsTable.date, latestWeekEnd),
      ),
    );

  const workoutIds = workouts.map((workout) => workout.id);
  const volumeByWorkoutId = new Map<number, number>();

  if (workoutIds.length > 0) {
    const rows = await db
      .select({
        workoutId: workoutSetsTable.workoutId,
        totalVolume: sql<string>`sum(${workoutSetsTable.reps} * ${workoutSetsTable.weightKg}::numeric)`,
      })
      .from(workoutSetsTable)
      .where(inArray(workoutSetsTable.workoutId, workoutIds))
      .groupBy(workoutSetsTable.workoutId);

    for (const row of rows) {
      volumeByWorkoutId.set(row.workoutId, Number(row.totalVolume));
    }
  }

  for (const bucket of buckets) {
    const weekWorkouts = workouts.filter(
      (workout) => workout.date >= bucket.start && workout.date <= bucket.end,
    );

    const weekVolume = weekWorkouts.reduce(
      (sum, workout) => sum + (volumeByWorkoutId.get(workout.id) ?? 0),
      0,
    );

    points.push({
      week: bucket.label,
      totalVolumeKg: Math.round(weekVolume),
      workoutCount: weekWorkouts.length,
    });
  }

  res.json(points);
});

router.get("/stats/personal-records", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const records = await db.execute(sql`
    SELECT DISTINCT ON (ws.exercise_id)
      ws.exercise_id as "exerciseId",
      ws.exercise_name as "exerciseName",
      ws.weight_kg::numeric as "maxWeightKg",
      w.date as "achievedAt"
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE w.user_id = ${userId}
    ORDER BY ws.exercise_id, ws.weight_kg::numeric DESC, w.date DESC
  `);

  const prs = (records.rows as Array<{ exerciseId: string; exerciseName: string; maxWeightKg: string; achievedAt: string }>).map((row) => ({
    exerciseId: parseInt(row.exerciseId, 10),
    exerciseName: row.exerciseName,
    maxWeightKg: Number(row.maxWeightKg),
    achievedAt: row.achievedAt,
  }));

  res.json(prs);
});

export default router;
