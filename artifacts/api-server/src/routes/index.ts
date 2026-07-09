import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import workoutsRouter from "./workouts.js";
import exercisesRouter from "./exercises.js";
import goalsRouter from "./goals.js";
import planningRouter from "./planning.js";
import statsRouter from "./stats.js";
import aiRouter from "./ai.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workoutsRouter);
router.use(exercisesRouter);
router.use(goalsRouter);
router.use(planningRouter);
router.use(statsRouter);
router.use(aiRouter);

export default router;
