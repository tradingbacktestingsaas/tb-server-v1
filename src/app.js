import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import httpStatus from 'http-status';
import { rateLimit } from 'express-rate-limit';
import {errorConverter,errorHandler} from './middlewares/error.js';
// import routes from './routes';
// import { errorConverter, errorHandler } from './middlewares/error';
import ApiError from './utils/ApiError.js';
import config from './config/env.js';
import logger from './utils/logger.js';
import dbConnection from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';


const app = express();

const allowedOrigins = [
  "https://woowsocial.com",
  "https://admin.woowsocial.com",
  "http://localhost:3000",
  "http://localhost:5000"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (Postman, curl)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // make sure OPTIONS always handled

// Parse JSON request body
app.use(express.json());

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// Connect to database
await dbConnection();

// Limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
  });

  // Apply to all auth routes
  app.use('/api/auth', limiter);
}

// API routes
// app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/user', usersRoutes);

// Send 404 for any unknown API request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Convert error to ApiError, if needed
app.use(errorConverter);

// Handle error
app.use(errorHandler);

export default app;
