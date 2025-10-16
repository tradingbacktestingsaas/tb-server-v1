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

import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import tradeAccRoutes from "./routes/tradeAccRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import strategiesRoutes from "./routes/strategiesRoutes.js";

const app = express();
const globalPrefix = "/public/api/v1";

const allowedOrigins = [
  "https://tradingbacktesting.com",
  "https://admin.woowsocial.com",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-recaptcha-token"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
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

app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
