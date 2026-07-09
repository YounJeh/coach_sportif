import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, userSessionsTable } from "@workspace/db";
import {
  CreatePlanningSessionBody,
  UpdatePlanningSessionParams,
  UpdatePlanningSessionBody,
  DeletePlanningSessionParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

function normalizeSession(session: typeof userSessionsTable.$inferSelect) {
  return {
    ...session,
    targetIntensityRpe:
      session.targetIntensityRpe == null ? null : Number(session.targetIntensityRpe),
  };
}

router.get("/planning/sessions", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const sessions = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.userId, userId))
    .orderBy(userSessionsTable.sessionDate);

  res.json(sessions.map(normalizeSession));
});

router.post("/planning/sessions", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreatePlanningSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [session] = await db
      .insert(userSessionsTable)
      .values({
        ...parsed.data,
        userId,
        sessionDate: parsed.data.sessionDate.toISOString().split("T")[0],
        goalId: parsed.data.goalId ?? null,
        targetIntensityRpe:
          parsed.data.targetIntensityRpe == null ? null : String(parsed.data.targetIntensityRpe),
        planData: parsed.data.planData ?? {},
        resultData: parsed.data.resultData ?? {},
        notes: parsed.data.notes ?? null,
      })
      .returning();

    res.status(201).json(normalizeSession(session));
  } catch (error) {
    const dbCode =
      typeof error === "object" && error && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    if (dbCode === "23505") {
      res.status(409).json({ error: "A session already exists for that date" });
      return;
    }

    throw error;
  }
});

router.patch("/planning/sessions/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePlanningSessionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdatePlanningSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.sessionDate) {
    updateData.sessionDate = parsed.data.sessionDate.toISOString().split("T")[0];
  }
  if (parsed.data.goalId === undefined) {
    delete updateData.goalId;
  }
  if (parsed.data.targetIntensityRpe != null) {
    updateData.targetIntensityRpe = String(parsed.data.targetIntensityRpe);
  }
  if (parsed.data.targetIntensityRpe === null) {
    updateData.targetIntensityRpe = null;
  }

  try {
    const [session] = await db
      .update(userSessionsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(userSessionsTable.id, params.data.id), eq(userSessionsTable.userId, userId)))
      .returning();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(normalizeSession(session));
  } catch (error) {
    const dbCode =
      typeof error === "object" && error && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    if (dbCode === "23505") {
      res.status(409).json({ error: "A session already exists for that date" });
      return;
    }

    throw error;
  }
});

router.delete("/planning/sessions/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePlanningSessionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(userSessionsTable)
    .where(and(eq(userSessionsTable.id, params.data.id), eq(userSessionsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;