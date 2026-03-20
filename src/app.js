// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import { rateLimit } from "express-rate-limit";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import ApiError from "./utils/ApiError.js";
import config from "./config/env.js";
import dbConnection from "./config/db.js";

import "./associations/userAssociation/index.js";
import "./associations/tradeAssociation/index.js";
import "./associations/ordersAssociation/index.js";

import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import tradeAccRoutes from "./routes/tradeAccRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import strategiesRoutes from "./routes/strategiesRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import plansRoutes from "./routes/planRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoute.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import ordersRoutes from "./routes/ordersRoutes.js";
import feedBackRoutes from "./routes/feedbackRoutes.js";
import bugReportRoutes from "./routes/bugReportRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import DashboardRoutes from "./routes/dashboardRoute.js";
import webhookRoute from "./routes/webhookRoute.js";
import userPersonalStrategyRoutes from "./routes/userPersonalStrategyRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";

import {
  startSubscriptionCron,
  reminderSubscriptionCron,
} from "./cron/subscriptionChecker.js";

const app = express();
const globalPrefix = "/public/api/v1";

const allowedOrigins = [
  "https://tradingbacktesting.com",
  "https://app.tradingbacktesting.com",
  "https://dev.tradingbacktesting.com",
  "https://tb-client-v1.vercel.app",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://tb-client-v2.vercel.app",
  "http://localhost:5000",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-recaptcha-token",
    "x-recaptcha-token",
    "stripe-signature",
  ],
};

// Webhooks must come BEFORE global body parsers
// Available endpoints:
// - POST /public/api/v1/webhook/stripe
// - POST /public/api/v1/webhook/tradesync
app.use(`${globalPrefix}/webhook`, webhookRoute);

// Global middlewares
app.use(express.json());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

await dbConnection();

if (config.env === "production") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  });
  app.use(`${globalPrefix}/auth`, limiter);
}

app.use(`${globalPrefix}/auth`, authRoutes);
app.use(`${globalPrefix}/users`, usersRoutes);
app.use(`${globalPrefix}/trade-account`, tradeAccRoutes);
app.use(`${globalPrefix}/trade`, tradeRoutes);
app.use(`${globalPrefix}/strategies`, strategiesRoutes);
app.use(`${globalPrefix}/notification`, notificationRoutes);
app.use(`${globalPrefix}/news`, newsRoutes);
app.use(`${globalPrefix}/plans`, plansRoutes);
app.use(`${globalPrefix}/subscription`, subscriptionRoutes);
app.use(`${globalPrefix}/analytics`, analyticsRoutes);
app.use(`${globalPrefix}/orders`, ordersRoutes);
app.use(`${globalPrefix}/coupons`, couponRoutes);
app.use(`${globalPrefix}/dashboard`, DashboardRoutes);
app.use(`${globalPrefix}/user-strategy`, userPersonalStrategyRoutes);
app.use(`${globalPrefix}/feedback`, feedbackRoutes);
app.use(`${globalPrefix}/bug-report`, bugReportRoutes);
app.use(`${globalPrefix}/feedback`, feedBackRoutes);

startSubscriptionCron();
reminderSubscriptionCron();

app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
