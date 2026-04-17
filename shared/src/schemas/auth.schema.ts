import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  companyName: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type LoginDTO = z.infer<typeof LoginSchema>;
export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;
