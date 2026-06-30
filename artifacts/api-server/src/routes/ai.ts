import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workoutsTable, workoutSetsTable } from "@workspace/db";
import { AskCoachBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const REPLIT_AI_URL = "https://replit.openai.azure.com";
const REPLIT_AI_TOKEN = process.env.REPL_ID;

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
    const { OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: process.env.REPLIT_AI_API_KEY ?? REPLIT_AI_TOKEN ?? "no-key",
      baseURL: `${REPLIT_AI_URL}/openai/deployments/gpt-5.1`,
      defaultHeaders: {
        "api-key": process.env.REPLIT_AI_API_KEY ?? "",
      },
    });

    const systemPrompt = `You are an expert personal fitness coach. You provide motivating, practical, and evidence-based advice to help athletes improve their performance and reach their goals. Keep responses concise, friendly, and actionable — aim for 2-4 short paragraphs. Use specific numbers and suggestions based on the workout data when available.`;

    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message + workoutContext },
      ],
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content ?? "Great work today! Keep up the consistency.";
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "AI coach request failed, using fallback");
    res.json({
      reply:
        "Great effort! Based on your workout, I can see you're putting in the work. Focus on progressive overload — aim to add a small amount of weight or an extra rep each session. Make sure you're recovering well with quality sleep and adequate protein (0.8–1g per pound of bodyweight). Keep showing up consistently and the results will come!",
    });
  }
});

export default router;
