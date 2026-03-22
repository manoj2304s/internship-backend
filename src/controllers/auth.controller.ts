import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import Otp from "../models/otp.model";
import RefreshToken from "../models/refresh-token.model";
import User from "../models/user.model";
import { sendEmail } from "../services/email.service";
import { OtpChannel, OtpPurpose, UserRole } from "../types/auth.types";
import asyncHandler from "../utils/async-handler";
import AppError from "../utils/app-error";

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((value) => value.toLowerCase().trim()),
  phone: z.string().trim().min(10),
  password: z.string().min(6),
  role: z.enum(["user", "admin", "super_admin"]).optional().default("user"),
  verificationChannel: z.enum(["email", "phone"]).optional().default("email"),
});

const verifyOtpSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase().trim()).optional(),
    phone: z.string().trim().min(10).optional(),
    otp: z.string().trim().length(6),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone is required",
    path: ["email"],
  });

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
});

const loginOtpSchema = z.object({
  phone: z.string().trim().min(10),
  otp: z.string().trim().length(6).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(6),
});

const createOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const buildUserResponse = (user: {
  _id: unknown;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
}) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isVerified: user.isVerified,
});

const createTokens = (userId: string, role: UserRole) => {
  const accessTokenExpiresIn =
    env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>;
  const refreshTokenExpiresIn =
    env.JWT_REFRESH_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>;

  const accessToken = jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: accessTokenExpiresIn,
  });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: refreshTokenExpiresIn,
  });

  return { accessToken, refreshToken };
};

const createRefreshTokenRecord = async (userId: string, token: string) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: userId,
    token,
    expiresAt,
  });
};

const revokeRefreshToken = async (token: string) => {
  await RefreshToken.updateOne(
    { token },
    {
      isRevoked: true,
    },
  );
};

const revokeAllUserRefreshTokens = async (userId: string) => {
  await RefreshToken.updateMany(
    { user: userId, isRevoked: false },
    {
      isRevoked: true,
    },
  );
};

const createOtpRecord = async (
  userId: string,
  purpose: OtpPurpose,
  channel: OtpChannel,
) => {
  await Otp.deleteMany({ user: userId, purpose });

  const otpCode = createOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MS);

  const otpRecord = await Otp.create({
    user: userId,
    code: otpCode,
    purpose,
    channel,
    expiresAt,
  });

  return otpRecord;
};

const deliverOtp = async (
  user: { email: string; phone: string },
  otpCode: string,
  purpose: OtpPurpose,
  channel: OtpChannel,
) => {
  if (channel === "email") {
    const emailResult = await sendEmail(
      user.email,
      `Your ${purpose} OTP`,
      `Your OTP is ${otpCode}. It expires in ${env.OTP_EXPIRY} minutes.`,
    );

    return {
      channel,
      deliveryMode: emailResult.mode,
      preview: emailResult.preview,
    };
  }

  console.log(`[SIMULATED PHONE OTP] phone=${user.phone} otp=${otpCode}`);
  return {
    channel,
    deliveryMode: "simulated" as const,
    preview: `OTP for ${user.phone}: ${otpCode}`,
  };
};

const findUserByEmailOrPhone = async (payload: {
  email?: string | undefined;
  phone?: string | undefined;
}) => {
  if (payload.email) {
    return User.findOne({ email: payload.email });
  }

  if (payload.phone) {
    return User.findOne({ phone: payload.phone });
  }

  return null;
};

const verifyOtpRecord = async (
  userId: string,
  purpose: OtpPurpose,
  code: string,
) => {
  const otpRecord = await Otp.findOne({ user: userId, purpose }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError("OTP not found", 400);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    throw new AppError("OTP has expired", 400);
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    throw new AppError("OTP attempt limit exceeded", 429);
  }

  if (otpRecord.code !== code) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new AppError("Invalid OTP", 400);
  }

  await Otp.deleteMany({ user: userId, purpose });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);

  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { phone: payload.phone }],
  });

  if (existingUser) {
    throw new AppError("Email or phone already in use", 409);
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password: hashedPassword,
    role: payload.role,
  });

  const otpRecord = await createOtpRecord(
    String(user._id),
    "verification",
    payload.verificationChannel,
  );
  const delivery = await deliverOtp(user, otpRecord.code, "verification", payload.verificationChannel);

  return res.status(201).json({
    message: "User registered successfully. Verify OTP to activate the account.",
    user: buildUserResponse(user),
    verification: {
      channel: payload.verificationChannel,
      expiresAt: otpRecord.expiresAt,
      maxAttempts: otpRecord.maxAttempts,
      deliveryMode: delivery.deliveryMode,
      preview: delivery.preview,
    },
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = verifyOtpSchema.parse(req.body);
  const user = payload.email
    ? await User.findOne({ email: payload.email })
    : await User.findOne({ phone: payload.phone as string });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  await verifyOtpRecord(String(user._id), "verification", payload.otp);

  user.isVerified = true;
  await user.save();

  return res.status(200).json({
    message: "Account verified successfully",
    user: buildUserResponse(user),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const passwordMatches = await bcrypt.compare(payload.password, user.password);
  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isVerified) {
    throw new AppError("Account is not verified", 403);
  }

  const { accessToken, refreshToken } = createTokens(String(user._id), user.role);
  await createRefreshTokenRecord(String(user._id), refreshToken);

  return res.status(200).json({
    message: "Login successful",
    accessToken,
    refreshToken,
    user: buildUserResponse(user),
  });
});

export const loginOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginOtpSchema.parse(req.body);
  const user = await User.findOne({ phone: payload.phone });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.isVerified) {
    throw new AppError("Account is not verified", 403);
  }

  if (!payload.otp) {
    const otpRecord = await createOtpRecord(String(user._id), "login", "phone");
    const delivery = await deliverOtp(user, otpRecord.code, "login", "phone");

    return res.status(200).json({
      message: "Login OTP generated successfully",
      verification: {
        channel: "phone",
        expiresAt: otpRecord.expiresAt,
        maxAttempts: otpRecord.maxAttempts,
        deliveryMode: delivery.deliveryMode,
        preview: delivery.preview,
      },
    });
  }

  await verifyOtpRecord(String(user._id), "login", payload.otp);
  const { accessToken, refreshToken } = createTokens(String(user._id), user.role);
  await createRefreshTokenRecord(String(user._id), refreshToken);

  return res.status(200).json({
    message: "Phone OTP login successful",
    accessToken,
    refreshToken,
    user: buildUserResponse(user),
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const payload = refreshTokenSchema.parse(req.body);

  let decoded: { userId: string };
  try {
    decoded = jwt.verify(payload.refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
    };
  } catch (error) {
    throw new AppError("Refresh token expired or invalid", 401);
  }

  const storedToken = await RefreshToken.findOne({
    token: payload.refreshToken,
    user: decoded.userId,
    isRevoked: false,
  });

  if (!storedToken || storedToken.expiresAt.getTime() < Date.now()) {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  await revokeRefreshToken(payload.refreshToken);

  const tokens = createTokens(String(user._id), user.role);
  await createRefreshTokenRecord(String(user._id), tokens.refreshToken);

  return res.status(200).json({
    message: "Token refreshed successfully",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = forgotPasswordSchema.parse(req.body);
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = resetToken;
  user.passwordResetExpiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MS);
  await user.save();

  const emailResult = await sendEmail(
    user.email,
    "Password Reset",
    `Your password reset token is ${resetToken}. It expires in 15 minutes.`,
  );

  return res.status(200).json({
    message: "Password reset token generated successfully",
    reset: {
      email: user.email,
      expiresAt: user.passwordResetExpiresAt,
      deliveryMode: emailResult.mode,
      preview: emailResult.preview,
    },
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = resetPasswordSchema.parse(req.body);
  const user = await User.findOne({ passwordResetToken: payload.token });

  if (!user) {
    throw new AppError("Invalid reset token", 400);
  }

  if (
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    throw new AppError("Reset token has expired", 400);
  }

  user.password = await bcrypt.hash(payload.newPassword, 10);
  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  await revokeAllUserRefreshTokens(String(user._id));

  return res.status(200).json({
    message: "Password reset successful",
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const payload = refreshTokenSchema.parse(req.body);
  await revokeRefreshToken(payload.refreshToken);

  return res.status(200).json({
    message: "Logout successful",
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.userId;

  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return res.status(200).json({
    message: "Authenticated user fetched successfully",
    user: buildUserResponse(user),
  });
});

export const adminOnly = asyncHandler(async (req: Request, res: Response) => {
  return res.status(200).json({
    message: "Admin access granted",
    user: (req as AuthenticatedRequest).user,
  });
});

export const superAdminOnly = asyncHandler(async (req: Request, res: Response) => {
  return res.status(200).json({
    message: "Super admin access granted",
    user: (req as AuthenticatedRequest).user,
  });
});
