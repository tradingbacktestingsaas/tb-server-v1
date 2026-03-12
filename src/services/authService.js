import createError from "http-errors";
import { Op } from "sequelize";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import { OAuth2Client } from "google-auth-library";
import { hashPassword, comparePassword } from "../utils/hash.js";
import {
  generateResetPasswordToken,
  generateToken,
  verifyToken,
} from "../utils/jwt.js";
import { sendEmail, sendPasswordResetEmail } from "../utils/email.js";
import config from "../config/env.js";
import TradeAccount from "../models/trade_account.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import Plan from "../models/plan.model.js";

var googleClient = new OAuth2Client(config.google.clientId);

export async function register(userDetail) {
  const existing = await User.findOne({ where: { email: userDetail.email } });
  if (existing) throw createError(409, "already-exists");
  const passwordHash = await hashPassword(userDetail.password);
  const email = userDetail.email.toLowerCase();
  const type = userDetail.type;
  const user = await User.create({
    ...userDetail,
    email,
    type,
    auth_provider: "local",
    password: passwordHash,
  });
  const token = generateToken(
    {
      sub: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      plan: user.plan,
      blocked: user.blocked,
      avatar_url: user.avatar_url,
      type: user.type,
    },
    "1h",
  );
  return {
    code: 201,
    success: true,
    message: "user-create",
    user: user,
    token,
    redirect: "/auth/signin",
  };
}

export async function login({ email, password }) {
  let redirect;

  const user = await User.findOne({
    where: { email, blocked: false, active: true },
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "blocked",
      "password",
      "avatar_url",
      "createdAt",
      "is_notifications_enabled",
      "is_update_enabled",
      "is_feedback_completed",
      "onboarding_completed",
      "is_verified",
      "auth_provider",
      "updatedAt",
      "role",
      "plan",
    ],
    include: [
      {
        model: TradeAccount,
        as: "tradeAccounts",
        where: { isActive: true },
        required: false,
      },
      {
        model: UserSubscription,
        as: "subscriptions",
        include: [{ model: Plan, as: "plan", attributes: ["code"] }],
      },
    ],
  });

  console.log(user);

  if (!user) throw createError(401, "not-found");
  const match = await comparePassword(password, user.password);
  if (!match) throw createError(401, "invalid-password");

  if (user.auth_provider !== "local") {
    await user.update({ auth_provider: "local" });
  }

  const token = generateToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      blocked: user.blocked,
      type: "user",
    },
    "1h",
  );

  const SignedInUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    plan: user.plan,
    onboarding_completed: user.onboarding_completed,
    is_verified: user.is_verified,
    is_notifications_enabled: user.is_notifications_enabled,
    is_update_enabled: user.is_update_enabled,
    is_feedback_completed: user.is_feedback_completed,
    blocked: user.blocked,
    avatar_url: user.avatar_url,
    tradeAccounts: user.tradeAccounts,
    subscriptions: user.subscriptions,
  };

  if (user) {
    if (user.role === "admin") {
      redirect = `/dashboard/a/${user.id}`;
    } else {
      redirect = `/dashboard/u/${user.id}`;
    }
  }
  //if user has subscription then redirect to dashboard
  //if user doesn't have subscription then redirect to subscription page

  return {
    user: SignedInUser,
    token,
    code: 200,
    redirect,
    success: true,
    message: "signin-success",
  };
}

export async function googleLogin({ credential }) {
  let token;

  if (!credential)
    return {
      success: false,
      message: "Google Credential missing",
    };

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.google.clientId,
  });

  if (!ticket)
    return {
      success: false,
      message: "google-signin-failed",
      data: null,
    };

  const payload = ticket.getPayload();
  const { email, given_name, picture, family_name } = payload;

  const user = await User.findOne({
    where: { email },
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "blocked",
      "password",
      "avatar_url",
      "createdAt",
      "is_notifications_enabled",
      "is_update_enabled",
      "is_feedback_completed",
      "onboarding_completed",
      "is_verified",
      "auth_provider",
      "updatedAt",
      "role",
      "plan",
    ],
    include: [
      {
        model: TradeAccount,
        as: "tradeAccounts",
        where: { isActive: true },
        required: false,
      },
      {
        model: UserSubscription,
        as: "subscriptions",
        include: [{ model: Plan, as: "plan", attributes: ["code"] }],
      },
    ],
  });

  if (user && !user.blocked && user.is_verified) {
    if (user.auth_provider !== "google") {
      await user.update({ auth_provider: "google" });
    }

    token = generateToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        blocked: user.blocked,
        type: "user",
      },
      "1h",
    );
    return {
      success: true,
      message: "google-signin-successful",
      data: user,
      token,
      code: 200,
    };
  }

  const passwordHash = await hashPassword(email);
  const newUser = await User.create({
    firstName: given_name,
    lastName: family_name,
    email: email,
    password: passwordHash,
    avatar_url: picture,
    auth_provider: "google",
    is_verified: true,
  });
  token = generateToken(
    {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      plan: newUser.plan,
      blocked: newUser.blocked,
      type: "user",
    },
    "1h",
  );

  return {
    success: true,
    message: "google-signin-successful",
    data: newUser,
    token,
    code: 200,
  };
}

export async function forgotPassword(email) {
  const user = await User.findOne({ where: { email: email } });
  if (!user) throw createError(400, "not-found");
  const { token, success, message } = await createPasswordResetToken(email);
  if (!token) throw createError(400, "Invalid request");
  return {
    token,
    success,
    message,
  };
}

export async function createPasswordResetToken(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) return;

  user.passwordResetVersion += 1;
  await user.save();

  const jti = user.passwordResetVersion;
  const payload = {
    sub: user.id,
    rv: user.passwordResetVersion,
    jti,
    purpose: "password_reset",
  };

  const token = generateResetPasswordToken(payload);
  await sendPasswordResetEmail(user.email, token);

  return {
    token,
    success: true,
    message: "sent-successfully",
  };
}

export async function resetPassword({ token, password }) {
  if (!token) throw createError(400, "No Token Provided");

  const payload = await verifyToken(token);

  if (payload.purpose !== "password_reset")
    throw createError(400, "Purpose Invalid");
  console.log(payload);

  const user = await User.findByPk(payload.sub);
  if (!user) throw createError(400, "User Not Found");

  if (payload.rv !== user.passwordResetVersion)
    throw createError(400, "Version Invalid");

  const passwordHash = await hashPassword(password);
  user.password = passwordHash;
  user.passwordResetVersion += 1;
  await user.save(user);
  return true;
}

function generateNumericOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

async function sendResendOTPEmail(to, otp) {
  const subject = "Your verification OTP";
  const text = `Your verification OTP is ${otp}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Email Verification OTP</h2>
      <p>Your OTP is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
}

async function sendPasswordResetOtpEmail(to, otp) {
  const subject = "Your password reset OTP";
  const text = `Your password reset OTP is ${otp}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Password Reset OTP</h2>
      <p>Your OTP is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
}

export async function verifyOTP({ email, otp }) {
  const normalizedEmail = email?.toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    return {
      code: 401,
      success: false,
      message: "user-not-found",
    };
  }

  const match = otp === user.otp;
  if (!match) {
    return {
      code: 401,
      success: false,
      message: "invalid-otp",
    };
  }

  const isOTPExpired = !user.otp_expiry || user.otp_expiry < new Date();
  if (isOTPExpired) {
    return {
      code: 401,
      success: false,
      message: "otp-expired",
    };
  }

  await user.update({
    is_verified: true,
    otp: null,
    otp_expiry: null,
  });

  return {
    code: 200,
    success: true,
    message: "otp-verified-successfully",
    data: {},
  };
}

export async function resendOTP(email) {
  const normalizedEmail = email?.toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    return {
      code: 404,
      success: false,
      message: "user-not-found",
    };
  }

  if (user.is_verified) {
    return {
      code: 400,
      success: false,
      message: "user-already-verified",
    };
  }

  const otp = generateNumericOtp(6);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await user.update({
    otp,
    otp_expiry: otpExpiry,
  });

  await sendResendOTPEmail(user.email, otp);

  return {
    code: 200,
    success: true,
    message: "otp-sent-successfully",
    data: { email: user.email },
  };
}

export async function sendPasswordResetOTP(email) {
  const normalizedEmail = email?.toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    return {
      code: 401,
      success: false,
      message: "user-not-found",
    };
  }

  const otp = generateNumericOtp(6);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await user.update({
    reset_otp: otp,
    reset_otp_expiry: otpExpiry,
  });

  await sendPasswordResetOtpEmail(user.email, otp);

  return {
    code: 200,
    success: true,
    message: "otp-sent-successfully",
    data: { email: user.email },
  };
}

export async function verifyPasswordResetOTP(email, otp) {
  const normalizedEmail = email?.toLowerCase();
  const user = await User.findOne({
    where: {
      email: normalizedEmail,
      reset_otp: otp,
      reset_otp_expiry: {
        [Op.gte]: new Date(),
      },
    },
  });

  return !!user;
}

export async function resetPasswordWithOTP(email, otp, newPassword) {
  const normalizedEmail = email?.toLowerCase();
  const isValid = await verifyPasswordResetOTP(normalizedEmail, otp);

  if (!isValid) {
    return {
      code: 401,
      success: false,
      message: "invalid-otp",
    };
  }

  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    return {
      code: 401,
      success: false,
      message: "user-not-found",
    };
  }

  const hashedPassword = await hashPassword(newPassword);

  await user.update({
    password: hashedPassword,
    reset_otp: null,
    reset_otp_expiry: null,
  });

  return {
    code: 200,
    success: true,
    message: "password-reset-successfully",
    data: {},
  };
}

export async function adminRegister({
  first_name,
  last_name,
  email,
  password,
  role = "admin",
}) {
  // Check if admin with this email already exists
  const existing = await Admin.findOne({ where: { email } });
  if (existing) throw createError(409, "Admin email already registered");

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create the admin
  const admin = await Admin.create({
    first_name,
    last_name,
    email,
    password: passwordHash,
    role,
    active: 1,
  });

  // Generate JWT token
  const token = generateToken(
    {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: "admin",
    },
    "24h",
  );

  return {
    code: 200,
    success: true,
    message: "Admin registered successfully",
    data: {
      id: admin.id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      role: admin.role,
    },
    token,
  };
}

export async function adminLogin({ email, password }) {
  // Find admin by email
  const admin = await Admin.findOne({ where: { email, active: 1 } });
  if (!admin) throw createError(401, "Invalid credentials");

  // Compare password
  const match = await comparePassword(password, admin.password);
  if (!match) throw createError(401, "Invalid credentials");

  // Generate JWT token
  const token = generateToken(
    {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: "admin",
    },
    "24h",
  );

  return {
    code: 200,
    success: true,
    message: "Admin logged in successfully",
    data: {
      id: admin.id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      role: admin.role,
    },
    token,
  };
}

export async function completeOnboarding(userId) {
  const user = await User.findByPk(userId);

  if (!user) {
    throw createError(404, "User not found");
  }

  if (user.onboarding_completed) {
    return {
      code: 200,
      success: true,
      message: "Onboarding already completed",
      data: { onboarding_completed: true },
    };
  }

  await user.update({ onboarding_completed: true });

  return {
    code: 200,
    success: true,
    message: "Onboarding completed successfully",
    data: { onboarding_completed: true },
  };
}

export const authService = {
  register,
  login,
  googleLogin,
  verifyOTP,
  resendOTP,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPasswordWithOTP,
  createPasswordResetToken,
  forgotPassword,
  resetPassword,
  adminRegister,
  adminLogin,
  completeOnboarding,
};
