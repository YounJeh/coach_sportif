import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalParams,
  UpdateGoalBody,
  DeleteGoalParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { type Request } from "express";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(goalsTable.createdAt);

  res.json(goals.map((g) => ({
    ...g,
    targetValue: Number(g.targetValue),
    currentValue: Number(g.currentValue),
  })));
});

router.post("/goals", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [goal] = await db
    .insert(goalsTable)
    .values({
      ...parsed.data,
      userId,
      targetValue: String(parsed.data.targetValue),
      currentValue: String(parsed.data.currentValue),
      deadline: parsed.data.deadline ? parsed.data.deadline.toISOString().split("T")[0] : null,
      completed: false,
    })
    .returning();

  res.status(201).json({
    ...goal,
    targetValue: Number(goal.targetValue),
    currentValue: Number(goal.currentValue),
  });
});

router.patch("/goals/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateGoalParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.targetValue != null) updateData.targetValue = String(parsed.data.targetValue);
  if (parsed.data.currentValue != null) updateData.currentValue = String(parsed.data.currentValue);

  const [goal] = await db
    .update(goalsTable)
    .set(updateData)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json({
    ...goal,
    targetValue: Number(goal.targetValue),
    currentValue: Number(goal.currentValue),
  });
});

router.delete("/goals/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteGoalParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
