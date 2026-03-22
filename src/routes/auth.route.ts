import { Router } from "express";
import {
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

export default router;
