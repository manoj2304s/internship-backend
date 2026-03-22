import { Router } from "express";
import {
  adminOnly,
  forgotPassword,
  login,
  loginOtp,
  logout,
  me,
  refreshToken,
  register,
  resetPassword,
  superAdminOnly,
  verifyOtp,
} from "../controllers/auth.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authRateLimiter);

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/login-otp", loginOtp);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.get("/admin", authenticate, authorize("admin", "super_admin"), adminOnly);
router.get("/super-admin", authenticate, authorize("super_admin"), superAdminOnly);

router.post("/login/otp/request", loginOtp);
router.post("/login/otp/verify", loginOtp);
router.post("/password-reset/request", forgotPassword);
router.post("/password-reset/confirm", resetPassword);

export default router;
