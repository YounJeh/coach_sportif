import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workoutsRouter from "./workouts";
import exercisesRouter from "./exercises";
import goalsRouter from "./goals";
import statsRouter from "./stats";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workoutsRouter);
router.use(exercisesRouter);
router.use(goalsRouter);
router.use(statsRouter);
router.use(aiRouter);

export default router;
