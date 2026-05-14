import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tournamentsRouter from "./tournaments";
import teamsRouter from "./teams";
import categoriesRouter from "./categories";
import playersRouter from "./players";
import auctionRouter from "./auction";
import analyticsRouter from "./analytics";
import authRouter from "./auth";
import adminReportsRouter from "./admin-reports";
import intelligenceRouter from "./intelligence";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(tournamentsRouter);
router.use(teamsRouter);
router.use(categoriesRouter);
router.use(playersRouter);
router.use(auctionRouter);
router.use(analyticsRouter);
router.use(adminReportsRouter);
router.use(intelligenceRouter);

export default router;
