import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid("production", "development", "test")
      .required(),
    PORT: Joi.number().default(3000),

    // Database - either DB_URL or individual connection parameters are required
    DB_URL: Joi.string().description(
      "Database connection URL (used for CockroachDB)"
    ),
    DB_HOST: Joi.string().description("Database host"),
    DB_PORT: Joi.number()
      .default(26257)
      .description("Database port (CockroachDB default is 26257)"),
    DB_NAME: Joi.string().description("Database name"),
    DB_USER: Joi.string().description("Database user"),
    DB_PASSWORD: Joi.string().description("Database password"),

    // JWT
    JWT_SECRET: Joi.string().required().description("JWT secret key"),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description("minutes after which access tokens expire"),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number()
      .default(30)
      .description("days after which refresh tokens expire"),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which reset password token expires"),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which verify email token expires"),
    JWT_RESET_LINK_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which verify resetlink token expires"),

    // SMTP
    SMTP_HOST: Joi.string().description("server that will send the emails"),
    SMTP_PORT: Joi.number().description("port to connect to the email server"),
    SMTP_USERNAME: Joi.string().description("username for email server"),
    SMTP_PASSWORD: Joi.string().description("password for email server"),
    EMAIL_FROM: Joi.string().description(
      "the from field in the emails sent by the app"
    ),

    // Frontend
    FRONTEND_URL: Joi.string().description(
      "Frontend URL for CORS and email templates"
    ),

    // Stripe
    STRIPE_SECRET_KEY: Joi.string().required().description("Stripe Secret Key"),
    STRIPE_WEBHOOK_SECRET: Joi.string().description("Stripe Webhook Secret"),
    STRIPE_CURRENCY: Joi.string()
      .default("usd")
      .description("Default currency for Stripe payments"),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Custom validation for database connection
if (
  !envVars.DB_URL &&
  !(envVars.DB_HOST && envVars.DB_NAME && envVars.DB_USER)
) {
  throw new Error(
    "Either DB_URL or all of DB_HOST, DB_NAME, and DB_USER must be provided"
  );
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  frontendUrl: envVars.FRONTEND_URL,

  db: {
    url: envVars.DB_URL,
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
  },

  crypto: {
    secretKey: envVars.CRYPTO_SECRET_KEY,
  },

  trade_sync: {
    url: envVars.TRADE_SYNC_URL,
    key: envVars.TRADE_SYNC_KEY,
    secret: envVars.TRADE_SYNC_SECRET,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes:
      envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    verifyResetLinkExpirationMinutes:
      envVars.VERIFY_RESET_LINK_EXPIRATION_MINUTES,
    resetLinkExpirationMinutes: envVars.JWT_RESET_LINK_EXPIRATION_MINUTES,
  },

  recaptcha: {
    siteKey: envVars.RECAPTCHA_SITE_KEY,
    secretKey: envVars.RECAPTCHA_SECRET_KEY,
  },

  imageKit: {
    publicKey: envVars.IMAGEKIT_PUBLIC_KEY,
    privateKey: envVars.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: envVars.IMAGEKIT_URL_ENDPOINT,
  },

  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },

  google: {
    clientId: envVars.GOOGLE_CLIENT_ID,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET,
  },

  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
    currency: envVars.STRIPE_CURRENCY || "usd",
  },

  websocket: {
    ws_cors_origin: envVars.WS_CORS_ORIGIN,
    ws_path: envVars.WS_PATH,
  },
};

export default config;

export const {
  env,
  port,
  frontendUrl,
  jwt: {
    secret,
    accessExpirationMinutes,
    refreshExpirationDays,
    resetPasswordExpirationMinutes,
    verifyEmailExpirationMinutes,
  },
} = config;

export const NODE_ENV = env;
export const PORT = port;
export const FRONTEND_URL = frontendUrl;
export const JWT_SECRET = secret;
export const JWT_ACCESS_EXPIRATION_MINUTES = accessExpirationMinutes;
export const JWT_REFRESH_EXPIRATION_DAYS = refreshExpirationDays;
export const JWT_RESET_PASSWORD_EXPIRATION_MINUTES =
  resetPasswordExpirationMinutes;
export const JWT_VERIFY_EMAIL_EXPIRATION_MINUTES = verifyEmailExpirationMinutes;
