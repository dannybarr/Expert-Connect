import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import authRouter from "./auth";
import expertsRouter from "./experts";
import bookingsRouter from "./bookings";
import platformRouter from "./platform";
import v1Router from "./v1";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(authRouter);
router.use(expertsRouter);
router.use(bookingsRouter);
router.use(platformRouter);
router.use(v1Router);

export default router;
