import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["verification", "login"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "phone"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Otp", otpSchema);
