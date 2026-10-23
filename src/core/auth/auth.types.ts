export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  tokenVersion: number;
}
