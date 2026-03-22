import { Router } from "express";
import {
  getCurrentUser,
  login,
  logout,
  requestPasswordReset,
  refreshAccessToken,
  register,
  resetPassword,
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp,
  verifyRegistrationOtp,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyRegistrationOtp);
router.post("/login", login);
router.post("/login/otp/request", requestPhoneLoginOtp);
router.post("/login/otp/verify", verifyPhoneLoginOtp);
router.post("/logout", logout);
router.post("/refresh-token", refreshAccessToken);
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", resetPassword);
router.get("/me", authenticate, getCurrentUser);

export default router;
