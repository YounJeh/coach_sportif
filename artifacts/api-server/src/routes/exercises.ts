import { Router, type IRouter } from "express";
import { db, exercisesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/exercises", async (_req, res): Promise<void> => {
  const exercises = await db.select().from(exercisesTable).orderBy(exercisesTable.name);
  res.json(exercises);
});

export default router;
