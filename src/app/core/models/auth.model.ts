export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  expiresIn: number;
}

export interface UserProfile {
  id?: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}
