import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, goalsTable, userSessionsTable, workoutsTable, workoutSetsTable } from "@workspace/db";
import { AskCoachBody, SaveCoachPlanBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { type Request } from "express";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const COACH_API_BASE_URL = process.env.COACH_API_BASE_URL ?? "https://coach-sportif-ia-api-kvl55ihqia-ew.a.run.app";
const AI_FALLBACK_REPLY =
  "Great effort! Based on your workout, I can see you're putting in the work. Focus on progressive overload - aim to add a small amount of weight or an extra rep each session. Make sure you're recovering well with quality sleep and adequate protein (0.8-1g per pound of bodyweight). Keep showing up consistently and the results will come!";
const DEFAULT_AVAILABLE_SLOTS = ["Mon-07:00", "Sun-20:00"] as const;

type PlanningStatus = "planned" | "done" | "skipped" | "adapted";

interface NormalizedPlannedSession {
  goalId: number | null;
  sessionDate: string;
  modality: "running" | "strength" | "fitness" | "recovery";
  title: string;
  targetDurationMin: number;
  targetIntensityRpe: number | null;
  status: PlanningStatus;
  notes: string | null;
  planData: Record<string, unknown>;
  resultData: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDateOnly(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split("T")[0];
}

function normalizeModality(value: unknown): "running" | "strength" | "fitness" | "recovery" {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("run")) return "running";
  if (raw.includes("strength") || raw.includes("muscu")) return "strength";
  if (raw.includes("recovery") || raw.includes("recover")) return "recovery";
  return "fitness";
}

function normalizeStatus(value: unknown): PlanningStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "done" || raw === "skipped" || raw === "adapted") {
    return raw;
  }
  return "planned";
}

function extractBriefingAthlete(payload: unknown): string | null {
  const root = asObject(payload);
  const briefing = asObject(root?.briefing);
  const athlete = briefing?.athlete;

  if (typeof athlete === "string") {
    return athlete;
  }
  if (athlete && typeof athlete === "object") {
    try {
      return JSON.stringify(athlete);
    } catch {
      return null;
    }
  }
  return null;
}

function extractBriefingCoach(payload: unknown): string | null {
  const root = asObject(payload);
  const briefing = asObject(root?.briefing);
  return asString(briefing?.coach);
}

function normalizePlannedSessions(payload: unknown): NormalizedPlannedSession[] {
  const root = asObject(payload);
  const plan = asObject(root?.plan);
  const rawItems = Array.isArray(plan?.sessions)
    ? plan.sessions.map((item) => asObject(item)).filter((item): item is Record<string, unknown> => item != null)
    : [];
  const normalized: NormalizedPlannedSession[] = [];

  for (const item of rawItems) {
    const sessionDate = asString(item.session_date);

    if (!sessionDate) continue;

    const dateOnly = toDateOnly(sessionDate);
    if (!dateOnly) continue;

    const duration =
      asNumber(item.target_duration_min) ??
      45;

    const intensity = asNumber(item.target_intensity_rpe);
    const planData = asObject(item.plan_data) ?? {};
    const resultData = asObject(item.result_data) ?? {};
    const goalId = asNumber(item.goal_id);

    normalized.push({
      goalId: goalId == null ? null : Math.round(goalId),
      sessionDate: dateOnly,
      modality: normalizeModality(item.modality),
      title: asString(item.title) ?? "Planned session",
      targetDurationMin: Math.max(1, Math.round(duration)),
      targetIntensityRpe: intensity == null ? null : Math.max(1, Math.min(10, intensity)),
      status: normalizeStatus(item.status),
      notes: asString(item.notes),
      planData,
      resultData,
    });
  }

  return normalized;
}

function normalizePreviewSessions(value: unknown): NormalizedPlannedSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: NormalizedPlannedSession[] = [];

  for (const entry of value) {
    const item = asObject(entry);
    if (!item) continue;

    const rawDate = item.sessionDate;
    const dateOnly =
      rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
        ? rawDate.toISOString().split("T")[0]
        : toDateOnly(String(rawDate ?? ""));
    if (!dateOnly) continue;

    const duration = asNumber(item.targetDurationMin) ?? 45;
    const intensity = asNumber(item.targetIntensityRpe);
    const goalId = asNumber(item.goalId);

    normalized.push({
      goalId: goalId == null ? null : Math.round(goalId),
      sessionDate: dateOnly,
      modality: normalizeModality(item.modality),
      title: asString(item.title) ?? "Planned session",
      targetDurationMin: Math.max(1, Math.round(duration)),
      targetIntensityRpe: intensity == null ? null : Math.max(1, Math.min(10, intensity)),
      status: normalizeStatus(item.status),
      notes: asString(item.notes),
      planData: asObject(item.planData) ?? {},
      resultData: asObject(item.resultData) ?? {},
    });
  }

  return normalized;
}

function extractAvailableSlots(message: string): string[] {
  const slotRegex = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(?:[01]\d|2[0-3]):[0-5]\d\b/g;
  const matches = message.match(slotRegex) ?? [];
  const extracted = Array.from(new Set(matches));
  return extracted.length > 0 ? extracted : [...DEFAULT_AVAILABLE_SLOTS];
}

async function resolveObjectiveAndDeadline(userId: string, fallbackObjective: string): Promise<{ objective: string; deadline: string }> {
  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.completed, false)))
    .orderBy(desc(goalsTable.createdAt))
    .limit(1);

  const objective = goal?.title?.trim() || fallbackObjective;
  const deadline =
    (goal?.deadline ? toDateOnly(goal.deadline) : null) ??
    toDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString()) ??
    new Date().toISOString().split("T")[0];

  return { objective, deadline };
}

async function persistPlannedSessions(userId: string, sessions: NormalizedPlannedSession[]): Promise<number> {
  let persistedCount = 0;

  for (const [index, session] of sessions.entries()) {
    try {
      await db
        .insert(userSessionsTable)
        .values({
          userId,
          goalId: session.goalId,
          sessionDate: session.sessionDate,
          modality: session.modality,
          title: session.title,
          targetDurationMin: session.targetDurationMin,
          targetIntensityRpe:
            session.targetIntensityRpe == null ? null : String(session.targetIntensityRpe),
          status: session.status,
          planData: session.planData,
          resultData: session.resultData,
          notes: session.notes,
        })
        .onConflictDoUpdate({
          target: [userSessionsTable.userId, userSessionsTable.sessionDate],
          set: {
            modality: session.modality,
            title: session.title,
            targetDurationMin: session.targetDurationMin,
            targetIntensityRpe:
              session.targetIntensityRpe == null ? null : String(session.targetIntensityRpe),
            status: session.status,
            planData: session.planData,
            resultData: session.resultData,
            goalId: session.goalId,
            notes: session.notes,
            updatedAt: new Date(),
          },
        });

      persistedCount += 1;
    } catch (err) {
      logger.error(
        {
          err,
          userId,
          sessionIndex: index,
          sessionDate: session.sessionDate,
          title: session.title,
          modality: session.modality,
        },
        "Failed to upsert user session",
      );
      throw err;
    }
  }

  return persistedCount;
}

router.post("/ai/coach", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = AskCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, workoutId } = parsed.data;

  let workoutContext = "";
  if (workoutId) {
    const [workout] = await db
      .select()
      .from(workoutsTable)
      .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.userId, userId)));

    if (workout) {
      const sets = await db
        .select()
        .from(workoutSetsTable)
        .where(eq(workoutSetsTable.workoutId, workout.id));

      const setsText = sets
        .map((s) => `  - ${s.exerciseName}: set ${s.setNumber}, ${s.reps} reps @ ${s.weightKg}kg`)
        .join("\n");

      workoutContext = `\n\nWorkout context:\nName: ${workout.name}\nDate: ${workout.date}\nDuration: ${workout.durationMinutes} minutes\nSets:\n${setsText}`;
    }
  }

  try {
    const { objective, deadline } = await resolveObjectiveAndDeadline(userId, message.trim());
    const availableSlots = extractAvailableSlots(message);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let planResponse: Response;
    try {
      planResponse = await fetch(`${COACH_API_BASE_URL}/v1/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          objective: `${objective}${workoutContext}`.trim(),
          deadline,
          available_slots: availableSlots,
          off_days: [],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!planResponse.ok) {
      const body = await planResponse.text();
      logger.error(
        {
          status: planResponse.status,
          body,
          userId,
        },
        "Coach IA API returned an error",
      );
      res.json({ reply: AI_FALLBACK_REPLY, briefingAthlete: null, plannedSessions: 0, planPreview: [] });
      return;
    }

    const payload = (await planResponse.json()) as unknown;

    const briefingCoach = extractBriefingCoach(payload);
    const briefingAthlete = extractBriefingAthlete(payload);
    const plannedSessions = normalizePlannedSessions(payload);

    const root = asObject(payload);
    const externalReply = asString(root?.reply) ?? asString(root?.message);
    const reply =
      externalReply ??
      briefingCoach ??
      "Plan generated successfully. Review it and save it to your planning tab when ready.";

    res.json({
      reply,
      briefingAthlete,
      plannedSessions: plannedSessions.length,
      planPreview: plannedSessions,
    });

    logger.info(
      {
        userId,
        plannedSessions: plannedSessions.length,
      },
      "AI coach plan generated",
    );
  } catch (err) {
    logger.error({ err, userId }, "AI coach request failed, using fallback");
    res.json({ reply: AI_FALLBACK_REPLY, briefingAthlete: null, plannedSessions: 0, planPreview: [] });
  }
});

router.post("/ai/coach/save-plan", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = SaveCoachPlanBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sessions = normalizePreviewSessions(parsed.data.sessions);

  if (sessions.length === 0) {
    res.status(400).json({ error: "No valid session to save" });
    return;
  }

  const savedSessions = await persistPlannedSessions(userId, sessions);
  logger.info({ userId, savedSessions }, "AI coach plan saved by user");
  res.json({ savedSessions });
});

export default router;
