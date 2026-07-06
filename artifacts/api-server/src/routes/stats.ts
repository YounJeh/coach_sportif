import { Router, type IRouter } from "express";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { db, workoutsTable, workoutSetsTable, exercisesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { type Request } from "express";

const router: IRouter = Router();

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
  const weeks = parseInt(String(req.query.weeks ?? "8"), 10) || 8;

  const points: Array<{ week: string; totalVolumeKg: number; workoutCount: number }> = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekWorkouts = await db
      .select()
      .from(workoutsTable)
      .where(
        and(
          eq(workoutsTable.userId, userId),
          gte(workoutsTable.date, weekStart.toISOString().split("T")[0]),
          sql`${workoutsTable.date} <= ${weekEnd.toISOString().split("T")[0]}`,
        ),
      );

    let weekVolume = 0;
    for (const w of weekWorkouts) {
      const sets = await db
        .select()
        .from(workoutSetsTable)
        .where(eq(workoutSetsTable.workoutId, w.id));
      weekVolume += sets.reduce((sum, s) => sum + s.reps * Number(s.weightKg), 0);
    }

    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    points.push({
      week: label,
      totalVolumeKg: Math.round(weekVolume),
      workoutCount: weekWorkouts.length,
    });
  }

  res.json(points);
});

router.get("/stats/personal-records", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const records = await db.execute(sql`
    SELECT
      ws.exercise_id as "exerciseId",
      ws.exercise_name as "exerciseName",
      MAX(ws.weight_kg::numeric) as "maxWeightKg",
      w.date as "achievedAt"
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE w.user_id = ${userId}
    GROUP BY ws.exercise_id, ws.exercise_name, w.date
    ORDER BY ws.exercise_name ASC
  `);

  const prs: Record<number, { exerciseId: number; exerciseName: string; maxWeightKg: number; achievedAt: string }> = {};
  for (const row of records.rows as Array<{ exerciseId: string; exerciseName: string; maxWeightKg: string; achievedAt: string }>) {
    const eid = parseInt(row.exerciseId, 10);
    const weight = Number(row.maxWeightKg);
    if (!prs[eid] || weight > prs[eid].maxWeightKg) {
      prs[eid] = {
        exerciseId: eid,
        exerciseName: row.exerciseName,
        maxWeightKg: weight,
        achievedAt: row.achievedAt,
      };
    }
  }

  res.json(Object.values(prs));
});

export default router;
