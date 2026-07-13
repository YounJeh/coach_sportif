import { Router, type IRouter, type Request } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, planningPlansTable, userSessionsTable } from "@workspace/db";
import {
  ListPlanningSessionsQueryParams,
  CreatePlanningPlanBody,
  CreatePlanningSessionBody,
  UpdatePlanningSessionParams,
  UpdatePlanningSessionBody,
  DeletePlanningSessionParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
const DEFAULT_PLAN_NAME = "Planning principal";

function normalizeSession(session: typeof userSessionsTable.$inferSelect) {
  return {
    ...session,
    targetIntensityRpe:
      session.targetIntensityRpe == null ? null : Number(session.targetIntensityRpe),
  };
}

async function ensureDefaultPlan(userId: string) {
  const [existing] = await db
    .select()
    .from(planningPlansTable)
    .where(eq(planningPlansTable.userId, userId))
    .orderBy(asc(planningPlansTable.createdAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(planningPlansTable)
    .values({ userId, name: DEFAULT_PLAN_NAME })
    .returning();

  return created;
}

async function resolvePlanId(userId: string, rawPlanId?: unknown): Promise<number> {
  if (rawPlanId == null || rawPlanId === "") {
    const plan = await ensureDefaultPlan(userId);
    return plan.id;
  }

  const parsed = Number(rawPlanId);
  if (!Number.isInteger(parsed)) {
    throw new Error("INVALID_PLAN_ID");
  }

  const [plan] = await db
    .select()
    .from(planningPlansTable)
    .where(and(eq(planningPlansTable.id, parsed), eq(planningPlansTable.userId, userId)))
    .limit(1);

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }

  return plan.id;
}

router.get("/planning/plans", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  await ensureDefaultPlan(userId);

  const plans = await db
    .select()
    .from(planningPlansTable)
    .where(eq(planningPlansTable.userId, userId))
    .orderBy(asc(planningPlansTable.createdAt));

  res.json(plans);
});

router.post("/planning/plans", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreatePlanningPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [plan] = await db
      .insert(planningPlansTable)
      .values({
        userId,
        name: parsed.data.name.trim(),
      })
      .returning();

    res.status(201).json(plan);
  } catch (error) {
    const dbCode =
      typeof error === "object" && error && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    if (dbCode === "23505") {
      res.status(409).json({ error: "A planning with this name already exists" });
      return;
    }

    throw error;
  }
});

router.get("/planning/sessions", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const queryParams = ListPlanningSessionsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let planId: number;
  try {
    planId = await resolvePlanId(userId, queryParams.data.planId);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PLAN_ID") {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    throw error;
  }

  const sessions = await db
    .select()
    .from(userSessionsTable)
    .where(and(eq(userSessionsTable.userId, userId), eq(userSessionsTable.planId, planId)))
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

  let planId: number;
  try {
    planId = await resolvePlanId(userId, parsed.data.planId);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PLAN_ID") {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    throw error;
  }

  try {
    const [session] = await db
      .insert(userSessionsTable)
      .values({
        userId,
        planId,
        sessionDate: parsed.data.sessionDate.toISOString().split("T")[0],
        modality: parsed.data.modality,
        title: parsed.data.title,
        targetDurationMin: parsed.data.targetDurationMin,
        status: parsed.data.status ?? "planned",
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
  if (parsed.data.planId != null) {
    try {
      updateData.planId = await resolvePlanId(userId, parsed.data.planId);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PLAN_ID") {
        res.status(400).json({ error: "Invalid plan id" });
        return;
      }
      if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
        res.status(404).json({ error: "Planning not found" });
        return;
      }
      throw error;
    }
  }
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