import { v4 as uuidv4 } from "uuid";
import crypto, { randomUUID } from "crypto";
import createError from "http-errors";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";

import { hashPassword, comparePassword } from "../utils/hash.js";
import {
  generateResetPasswordToken,
  generateToken,
  verifyToken,
} from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../utils/email.js";

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
  return { user: user, token, redirectUrl: process.env.FRONTEND_URL };
}

export async function login({ email, password }) {
  let redirectUrl;
  const user = await User.findOne({
    where: { email, blocked: false, active: true },
  });
  if (!user) throw createError(401, "Invalid credentials");
  const match = await comparePassword(password, user.password);
  if (!match) throw createError(401, "Invalid credentials");
  const token = generateToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "user",
    },
    "1h"
  );
  //if user has subscription then redirect to dashboard
  //if user doesn't have subscription then redirect to subscription page
  redirectUrl = "/protected-route/dashboard";

  return {
    user: { id: user.id, name: user.name, email: user.email },
    token,
    redirectUrl,
  };
}

export async function forgotPassword(email) {
  const user = await User.findOne({ where: { email: email } });
  if (!user) throw createError(400, "Invalid request");
  const token = await createPasswordResetToken(email);
  if (!token) throw createError(400, "Invalid request");
  return { token };
}

export async function createPasswordResetToken(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) return;

  user.passwordResetVersion += 1;
  await user.save();

  const jti = user.passwordResetVersion.toString();
  const payload = {
    sub: user.id,
    rv: user.passwordResetVersion,
    jti,
    purpose: "password_reset",
  };

  const token = await generateResetPasswordToken(payload);
  await sendPasswordResetEmail(user.email, token);
  return token;
}

export async function resetPassword({ email, token, newPassword }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw createError(400, "User Not Found");

  const payload = await verifyToken(token);
  console.log(payload);
  if (payload.purpose !== "password_reset")
    throw createError(400, "Purpose Invalid");

  if (payload.rv !== user.passwordResetVersion)
    throw createError(400, "Version Invalid");

  const passwordHash = await hashPassword(newPassword);
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
  createPasswordResetToken,
  forgotPassword,
  resetPassword,
  adminRegister,
  adminLogin,
};
