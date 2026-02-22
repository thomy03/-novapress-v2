import { API_CONFIG } from '../config';
import { apiClient } from '../client';

export interface BillingStatus {
  tier: 'free' | 'pro' | 'enterprise';
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export const billingService = {
  /**
   * Create a Stripe Checkout session and return the redirect URL.
   * The browser should be redirected to `url` to complete payment.
   */
  async createCheckout(priceId: string, annual: boolean): Promise<CheckoutResponse> {
    return apiClient.post<CheckoutResponse>(
      API_CONFIG.ENDPOINTS.BILLING.CHECKOUT,
      { priceId, annual },
    );
  },

  /**
   * Create a Stripe Customer Portal session.
   * Redirects to Stripe's hosted page where the user can manage
   * their subscription, update payment methods, or cancel.
   */
  async createPortal(): Promise<PortalResponse> {
    return apiClient.post<PortalResponse>(
      API_CONFIG.ENDPOINTS.BILLING.PORTAL,
    );
  },

  /**
   * Get the current subscription status for the authenticated user.
   */
  async getStatus(): Promise<BillingStatus> {
    return apiClient.get<BillingStatus>(
      API_CONFIG.ENDPOINTS.BILLING.STATUS,
    );
  },
};
