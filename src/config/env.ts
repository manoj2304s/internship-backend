import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().min(1).default("mongodb://localhost:27017/internshipBackend"),
  JWT_SECRET: z.string().min(1).default("access-secret-dev"),
  JWT_REFRESH_SECRET: z.string().min(1).default("refresh-secret-dev"),
  JWT_EXPIRES_IN: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  OTP_EXPIRY: z.coerce.number().default(10),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  OTP_EXPIRY_MS: parsed.OTP_EXPIRY * 60 * 1000,
  PASSWORD_RESET_EXPIRY_MS: 15 * 60 * 1000,
};
