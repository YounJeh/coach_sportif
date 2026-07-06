import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, workoutsTable, workoutSetsTable, exercisesTable } from "@workspace/db";
import {
  ListWorkoutsQueryParams,
  CreateWorkoutBody,
  GetWorkoutParams,
  UpdateWorkoutParams,
  UpdateWorkoutBody,
  DeleteWorkoutParams,
  ListWorkoutSetsParams,
  AddWorkoutSetParams,
  AddWorkoutSetBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { type Request } from "express";

const router: IRouter = Router();

router.get("/workouts", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = ListWorkoutsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;

  const workouts = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.userId, userId))
    .orderBy(desc(workoutsTable.date))
    .limit(limit)
    .offset(offset);

  const workoutsWithVolume = await Promise.all(
    workouts.map(async (w) => {
      const sets = await db
        .select()
        .from(workoutSetsTable)
        .where(eq(workoutSetsTable.workoutId, w.id));
      const totalVolume = sets.reduce(
        (sum, s) => sum + s.reps * Number(s.weightKg),
        0,
      );
      return { ...w, totalVolume, sets: [] };
    }),
  );

  res.json(workoutsWithVolume);
});

router.post("/workouts", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workout] = await db
    .insert(workoutsTable)
    .values({ ...parsed.data, date: parsed.data.date.toISOString().split("T")[0], userId })
    .returning();

  res.status(201).json({ ...workout, totalVolume: 0, sets: [] });
});

router.get("/workouts/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetWorkoutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [workout] = await db
    .select()
    .from(workoutsTable)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)));

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  const sets = await db
    .select()
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.workoutId, workout.id));

  const totalVolume = sets.reduce((sum, s) => sum + s.reps * Number(s.weightKg), 0);

  res.json({ ...workout, totalVolume, sets });
});

router.patch("/workouts/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateWorkoutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    ...(parsed.data.date ? { date: (parsed.data.date as Date).toISOString().split("T")[0] } : {}),
  };

  const [workout] = await db
    .update(workoutsTable)
    .set(updateData)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)))
    .returning();

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  const sets = await db
    .select()
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.workoutId, workout.id));

  const totalVolume = sets.reduce((sum, s) => sum + s.reps * Number(s.weightKg), 0);
  res.json({ ...workout, totalVolume, sets });
});

router.delete("/workouts/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteWorkoutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(workoutsTable)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/workouts/:id/sets", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListWorkoutSetsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [workout] = await db
    .select()
    .from(workoutsTable)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)));

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  const sets = await db
    .select()
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.workoutId, params.data.id));

  res.json(sets);
});

router.post("/workouts", requireAuth, async (req: Request, res): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const parsed = CreateWorkoutBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [workout] = await db
      .insert(workoutsTable)
      .values({
        ...parsed.data,
        date: parsed.data.date.toISOString().split("T")[0],
        userId,
      })
      .returning();

    res.status(201).json({ ...workout, totalVolume: 0, sets: [] });
  } catch (error) {
    console.error("POST /workouts failed:", error);
    console.error("POST /workouts cause:", (error as any)?.cause);
    res.status(500).json({
      error: "Failed to create workout",
      cause: (error as any)?.cause?.message,
      code: (error as any)?.cause?.code,
      detail: (error as any)?.cause?.detail,
      constraint: (error as any)?.cause?.constraint,
    });
  }
});

// router.post("/workouts/:id/sets", requireAuth, async (req: Request, res): Promise<void> => {
//   const userId = (req as AuthenticatedRequest).userId;
//   const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
//   const params = AddWorkoutSetParams.safeParse({ id: parseInt(raw, 10) });
//   if (!params.success) {
//     res.status(400).json({ error: "Invalid id" });
//     return;
//   }

//   const [workout] = await db
//     .select()
//     .from(workoutsTable)
//     .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)));

//   if (!workout) {
//     res.status(404).json({ error: "Workout not found" });
//     return;
//   }

//   const parsed = AddWorkoutSetBody.safeParse(req.body);
//   if (!parsed.success) {
//     res.status(400).json({ error: parsed.error.message });
//     return;
//   }

//   const exercise = await db
//     .select()
//     .from(exercisesTable)
//     .where(eq(exercisesTable.id, parsed.data.exerciseId))
//     .then((r) => r[0]);

//   if (!exercise) {
//     res.status(404).json({ error: "Exercise not found" });
//     return;
//   }

//   const [newSet] = await db
//     .insert(workoutSetsTable)
//     .values({
//       workoutId: params.data.id,
//       exerciseId: parsed.data.exerciseId,
//       exerciseName: exercise.name,
//       setNumber: parsed.data.setNumber,
//       reps: parsed.data.reps,
//       weightKg: String(parsed.data.weightKg),
//       notes: parsed.data.notes ?? null,
//     })
//     .returning();

//   res.status(201).json(newSet);
// });

export default router;
