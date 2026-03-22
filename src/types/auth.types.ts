type UserRole = "user" | "admin" | "super_admin";
type OtpPurpose = "verification" | "login";
type OtpChannel = "email" | "phone";

export type { OtpChannel, OtpPurpose, UserRole };
