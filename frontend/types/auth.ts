// Types for authentication — Event Booking Platform

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}


export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'super-admin' | 'organizer' | 'customer';
  created_at?: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}
