import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/user.model";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "access-secret-dev";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ?? "refresh-secret-dev";
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const PASSWORD_RESET_EXPIRES_IN_MS = 15 * 60 * 1000;

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((value) => value.toLowerCase().trim()),
  phone: z.string().trim().min(10),
  password: z.string().min(6),
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

const requestPhoneOtpSchema = z.object({
  phone: z.string().trim().min(10),
});

const verifyPhoneOtpLoginSchema = z.object({
  phone: z.string().trim().min(10),
  otp: z.string().trim().length(6),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const passwordResetRequestSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
});

const passwordResetSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(6),
});

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

const buildUserResponse = (user: {
  _id: unknown;
  name: string;
  email: string;
  phone: string;
  isVerified: boolean;
}) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  isVerified: user.isVerified,
});

const issueOtp = async (
  userId: string,
  purpose: "verification" | "login",
  channel: "email" | "phone",
) => {
  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MS);

  await User.findByIdAndUpdate(userId, {
    otpCode,
    otpPurpose: purpose,
    otpChannel: channel,
    otpExpiresAt,
  });

  return { otpCode, otpExpiresAt };
};

const clearOtpState = {
  otpCode: null,
  otpPurpose: null,
  otpChannel: null,
  otpExpiresAt: null,
};

const clearPasswordResetState = {
  passwordResetToken: null,
  passwordResetExpiresAt: null,
};

export const register = async (req: Request, res: Response) => {
  try {
    const payload = registerSchema.parse(req.body);

    const existingUser = await User.findOne({
      $or: [{ email: payload.email }, { phone: payload.phone }],
    });

    if (existingUser) {
      const duplicateField =
        existingUser.email === payload.email ? "email" : "phone";

      return res.status(409).json({
        message: `${duplicateField} already in use`,
      });
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const user = await User.create({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      password: hashedPassword,
    });

    const { otpCode, otpExpiresAt } = await issueOtp(
      String(user._id),
      "verification",
      payload.verificationChannel,
    );

    const freshUser = await User.findById(user._id);

    return res.status(201).json({
      message: "User registered successfully. Verify OTP to activate the account.",
      user: buildUserResponse(
        freshUser ?? {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isVerified: false,
        },
      ),
      verification: {
        channel: payload.verificationChannel,
        expiresAt: otpExpiresAt,
        otp: otpCode,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid registration payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const verifyRegistrationOtp = async (req: Request, res: Response) => {
  try {
    const payload = verifyOtpSchema.parse(req.body);
    const query = payload.email
      ? { email: payload.email }
      : { phone: payload.phone as string };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.otpCode || user.otpPurpose !== "verification") {
      return res.status(400).json({
        message: "No verification OTP found",
      });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    if (user.otpCode !== payload.otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    await User.updateOne(
      { _id: user._id },
      {
        isVerified: true,
        ...clearOtpState,
      },
    );

    return res.status(200).json({
      message: "Account verified successfully",
      user: buildUserResponse({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: true,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid OTP verification payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Account is not verified",
      });
    }

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: buildUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid login payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Login unsuccessful",
    });
  }
};

export const requestPhoneLoginOtp = async (req: Request, res: Response) => {
  try {
    const payload = requestPhoneOtpSchema.parse(req.body);
    const user = await User.findOne({ phone: payload.phone });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const { otpCode, otpExpiresAt } = await issueOtp(
      String(user._id),
      "login",
      "phone",
    );

    return res.status(200).json({
      message: "Phone OTP generated successfully",
      verification: {
        channel: "phone",
        expiresAt: otpExpiresAt,
        otp: otpCode,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid phone OTP request payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const verifyPhoneLoginOtp = async (req: Request, res: Response) => {
  try {
    const payload = verifyPhoneOtpLoginSchema.parse(req.body);
    const user = await User.findOne({ phone: payload.phone });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.otpCode || user.otpPurpose !== "login" || user.otpChannel !== "phone") {
      return res.status(400).json({
        message: "No phone login OTP found",
      });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    if (user.otpCode !== payload.otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    await User.updateOne(
      { _id: user._id },
      {
        refreshToken,
        ...clearOtpState,
      },
    );

    return res.status(200).json({
      message: "Phone OTP login successful",
      accessToken,
      refreshToken,
      user: buildUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid phone OTP verification payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const payload = refreshTokenSchema.parse(req.body);

    const decoded = jwt.verify(payload.refreshToken, REFRESH_TOKEN_SECRET) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== payload.refreshToken) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid refresh token payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(401).json({
      message: "Refresh token expired or invalid",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const payload = refreshTokenSchema.parse(req.body);

    const decoded = jwt.verify(payload.refreshToken, REFRESH_TOKEN_SECRET) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== payload.refreshToken) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    await User.updateOne(
      { _id: user._id },
      {
        refreshToken: null,
      },
    );

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid logout payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(401).json({
      message: "Refresh token expired or invalid",
    });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const payload = passwordResetRequestSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const passwordResetExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRES_IN_MS,
    );

    await User.updateOne(
      { _id: user._id },
      {
        passwordResetToken: resetToken,
        passwordResetExpiresAt,
      },
    );

    return res.status(200).json({
      message: "Password reset token generated successfully",
      reset: {
        email: user.email,
        token: resetToken,
        expiresAt: passwordResetExpiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid password reset request payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const payload = passwordResetSchema.parse(req.body);

    const user = await User.findOne({ passwordResetToken: payload.token });
    if (!user) {
      return res.status(400).json({
        message: "Invalid reset token",
      });
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({
        message: "Reset token has expired",
      });
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

    await User.updateOne(
      { _id: user._id },
      {
        password: hashedPassword,
        refreshToken: null,
        ...clearPasswordResetState,
      },
    );

    return res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid password reset payload",
        errors: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
