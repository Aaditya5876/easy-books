import { LoginDTO, RegisterDTO } from '@easy-books/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthService {
  register(dto: RegisterDTO): Promise<AuthTokens>;
  login(dto: LoginDTO): Promise<AuthTokens>;
  refresh(userId: string, refreshToken: string): Promise<AuthTokens>;
  logout(userId: string): Promise<void>;
  me(userId: string): Promise<{ id: string; email: string; name: string; role: string; companyId: string | null }>;
}

export const AUTH_SERVICE = Symbol('IAuthService');
