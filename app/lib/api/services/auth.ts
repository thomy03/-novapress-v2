import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import { 
  User, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest,
  UserPreferences 
} from '@/app/types/api';

export const authService = {
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<{ user: User; tokens: AuthTokens }>(
      API_CONFIG.ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    
    apiClient.setTokens(response.tokens);
    return response;
  },

  async register(data: RegisterRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<{ user: User; tokens: AuthTokens }>(
      API_CONFIG.ENDPOINTS.AUTH.REGISTER,
      data
    );
    
    apiClient.setTokens(response.tokens);
    return response;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
    } finally {
      apiClient.clearTokens();
    }
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.patch<User>(API_CONFIG.ENDPOINTS.AUTH.PROFILE, data);
  },

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
    return apiClient.patch<User>(API_CONFIG.ENDPOINTS.PREFERENCES, preferences);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return apiClient.post(`${API_CONFIG.ENDPOINTS.AUTH.PROFILE}/password`, {
      currentPassword,
      newPassword,
    });
  },

  async requestPasswordReset(email: string): Promise<void> {
    return apiClient.post(`${API_CONFIG.ENDPOINTS.AUTH.PROFILE}/reset-password`, {
      email,
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return apiClient.post(`${API_CONFIG.ENDPOINTS.AUTH.PROFILE}/reset-password/confirm`, {
      token,
      newPassword,
    });
  },

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('accessToken');
  },
};