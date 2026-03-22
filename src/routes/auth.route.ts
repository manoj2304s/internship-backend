import { Router } from "express";
import {
  login,
  refreshAccessToken,
  register,
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
router.post("/refresh-token", refreshAccessToken);

export default router;
