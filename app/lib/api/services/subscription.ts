import { apiClient } from '../client';
import { SubscriptionFeatures } from '@/app/types/api';

const SUBSCRIPTION_ENDPOINT = '/api/subscription';

export const subscriptionService = {
  /**
   * Get the features available for the current user's subscription tier.
   * Works for both authenticated and anonymous users.
   *
   * Returns:
   *   {
   *     tier: "free" | "pro" | "enterprise",
   *     features: string[],
   *     limits: { syntheses_per_day: number, syntheses_used_today: number }
   *   }
   */
  async getFeatures(): Promise<SubscriptionFeatures> {
    return apiClient.get<SubscriptionFeatures>(`${SUBSCRIPTION_ENDPOINT}/features`);
  },

  /**
   * Check if a specific feature is available in the current subscription.
   * Fetches the full feature list and checks membership.
   */
  async hasFeature(featureName: string): Promise<boolean> {
    const data = await this.getFeatures();
    return data.features.includes(featureName);
  },

  /**
   * Check if the current user has reached their daily synthesis view limit.
   * Returns true if the user can still view syntheses.
   */
  async canViewSynthesis(): Promise<boolean> {
    const data = await this.getFeatures();
    // Unlimited
    if (data.limits.syntheses_per_day === -1) {
      return true;
    }
    return data.limits.syntheses_used_today < data.limits.syntheses_per_day;
  },
};
