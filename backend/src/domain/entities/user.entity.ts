export class UserEntity {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  companyId: string | null;
  refreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}
