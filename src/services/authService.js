import createError from "http-errors";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import { OAuth2Client } from "google-auth-library";
import { hashPassword, comparePassword } from "../utils/hash.js";
import {
  generateResetPasswordToken,
  generateToken,
  verifyToken,
} from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import config from "../config/env.js";

var googleClient = new OAuth2Client(config.google.clientId);

export async function register(userDetail) {
  const existing = await User.findOne({ where: { email: userDetail.email } });
  if (existing) throw createError(409, "Email already registered");
  const passwordHash = await hashPassword(userDetail.password);
  const user = await User.create({ ...userDetail, password: passwordHash });
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
      type: "user",
    },
    "1h"
  );
  return { user: user, token, redirect: "/auth/signin" };
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
      "updatedAt",
      "role",
      "plan",
    ],
  });
  if (!user) throw createError(401, "Invalid credentials");
  const match = await comparePassword(password, user.password);
  if (!match) throw createError(401, "Invalid credentials");
  const token = generateToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      blocked: user.blocked,
      type: "user",
    },
    "1h"
  );

  const SignedInUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    plan: user.plan,
    blocked: user.blocked,
    avatar_url: user.avatar_url,
    activeTradeAccountId: user.activeTradeAccountId,
  };

  //if user has subscription then redirect to dashboard
  //if user doesn't have subscription then redirect to subscription page
  redirect = "/dashboard";

  return {
    user: SignedInUser,
    token,
    redirect,
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
      message: "Google Sign-In failed",
      data: null,
    };

  const payload = ticket.getPayload();
  const { email, given_name, picture, family_name } = payload;

  const user = await User.findOne({
    where: { email: email },
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "blocked",
      "avatar_url",
      "createdAt",
      "updatedAt",
      "role",
      "plan",
    ],
  });

  if (user) {
    token = generateToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        blocked: user.blocked,
        type: "user",
      },
      "1h"
    );
    return {
      success: true,
      message: "Google Sign-In successful",
      data: user,
      token,
    };
  }

  const passwordHash = await hashPassword(email);
  const newUser = await User.create({
    firstName: given_name,
    lastName: family_name,
    email: email,
    password: passwordHash,
    avatar_url: picture,
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
    "1h"
  );

  return {
    success: true,
    message: "Google Sign-In successful",
    data: newUser,
    token: token,
  };
}

export async function forgotPassword(email) {
  const user = await User.findOne({ where: { email: email } });
  if (!user) throw createError(400, "Invalid request");
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
    message: "Email sent successfully",
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
    "24h"
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
    "24h"
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

export const authService = {
  register,
  login,
  googleLogin,
  createPasswordResetToken,
  forgotPassword,
  resetPassword,
  adminRegister,
  adminLogin,
};
