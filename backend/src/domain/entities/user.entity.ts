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
  createdAt: Date;
  updatedAt: Date;
}
