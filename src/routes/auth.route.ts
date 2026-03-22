import { Router } from "express";
import {
  getAdminDashboard,
  getCurrentUser,
  login,
  logout,
  requestPasswordReset,
  refreshAccessToken,
  register,
  resetPassword,
  getSuperAdminDashboard,
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp,
  verifyRegistrationOtp,
} from "../controllers/auth.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

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
router.get("/admin", authenticate, authorize("admin", "super_admin"), getAdminDashboard);
router.get("/super-admin", authenticate, authorize("super_admin"), getSuperAdminDashboard);

export default router;
