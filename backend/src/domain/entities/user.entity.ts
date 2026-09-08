export class UserEntity {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  refreshToken: string | null;
  emailVerified: boolean;
  verificationOtp: string | null;
  otpExpiresAt: Date | null;
  mustChangePassword: boolean;
  staffTags: string[];
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
