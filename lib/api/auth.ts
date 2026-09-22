import { apiClient, ApiResponse } from '../apiClient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'collector' | 'recycler' | 'admin';
  phone?: string;
  location?: string;
  avatar?: string;
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: 'collector' | 'recycler';
  phone?: string;
  location?: string;
  address?: string;
  organizationName?: string;
  businessName?: string;
  registrationId?: string;
  acceptedMaterials?: string[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthData {
  user: User;
  profile?: any;
}

export const authApi = {
  /**
   * Register a new collector or recycler account
   */
  register: async (input: RegisterInput): Promise<AuthData> => {
    const res = await apiClient.post<ApiResponse<AuthData>>('/auth/register', input);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Registration failed - no user data returned from server');
    }
    return res.data;
  },

  /**
   * Login with email and password
   * Sets the HttpOnly authentication cookie in browser
   */
  login: async (credentials: LoginInput): Promise<AuthData> => {
    const res = await apiClient.post<ApiResponse<AuthData>>('/auth/login', credentials);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Login failed - no user data returned from server');
    }
    return res.data;
  },

  /**
   * Retrieve the current authenticated user from session cookie
   */
  getCurrentUser: async (): Promise<AuthData> => {
    const res = await apiClient.get<ApiResponse<AuthData>>('/auth/me');
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to retrieve session - no user data returned');
    }
    return res.data;
  },

  /**
   * Logout current session
   * Backend clears the HttpOnly auth cookie
   */
  logout: async (): Promise<void> => {
    await apiClient.post<ApiResponse>('/auth/logout');
  },
};
