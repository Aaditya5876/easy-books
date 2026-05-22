import { LoginDTO, RegisterDTO } from '@easy-books/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface IAuthService {
  register(dto: RegisterDTO): Promise<{ requiresVerification: true; email: string }>;
  login(dto: LoginDTO): Promise<AuthTokens & { mustChangePassword: boolean }>;
  verifyOtp(email: string, otp: string): Promise<AuthTokens>;
  resendOtp(email: string): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  refresh(userId: string, refreshToken: string): Promise<AuthTokens>;
  logout(userId: string): Promise<void>;
  me(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    defaultCompanyId: string | null;
    defaultCompany: any;
  }>;
}

export const AUTH_SERVICE = Symbol('IAuthService');
