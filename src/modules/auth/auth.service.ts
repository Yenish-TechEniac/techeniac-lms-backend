import { UserRole } from '../users';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './schemas/auth.schemas';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUserPayload;
  tokens: AuthTokens;
}

export interface IAuthService {
  login(input: LoginInput): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<AuthResult>;
  logout(refreshToken?: string): Promise<void>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
}

export class AuthService implements IAuthService {
  public login(_input: LoginInput): Promise<AuthResult> {
    void _input;
    return Promise.reject(new Error('Method not implemented.'));
  }

  public refresh(_refreshToken: string): Promise<AuthResult> {
    void _refreshToken;
    return Promise.reject(new Error('Method not implemented.'));
  }

  public logout(_refreshToken?: string): Promise<void> {
    void _refreshToken;
    return Promise.reject(new Error('Method not implemented.'));
  }

  public forgotPassword(_input: ForgotPasswordInput): Promise<void> {
    void _input;
    return Promise.reject(new Error('Method not implemented.'));
  }

  public resetPassword(_input: ResetPasswordInput): Promise<void> {
    void _input;
    return Promise.reject(new Error('Method not implemented.'));
  }

  public changePassword(_userId: string, _input: ChangePasswordInput): Promise<void> {
    void _userId;
    void _input;
    return Promise.reject(new Error('Method not implemented.'));
  }
}

export const authService = new AuthService();
