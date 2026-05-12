export class UserEntity {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  refreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}
