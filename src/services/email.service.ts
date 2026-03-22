import nodemailer from "nodemailer";
import { env } from "../config/env";

type EmailResult = {
  mode: "email" | "simulated";
  preview: string;
};

const createTransporter = () => {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  });
};

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
): Promise<EmailResult> => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[SIMULATED EMAIL] to=${to} subject=${subject} text=${text}`);
    return {
      mode: "simulated",
      preview: text,
    };
  }

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject,
    text,
  });

  return {
    mode: "email",
    preview: "Email sent successfully",
  };
};
