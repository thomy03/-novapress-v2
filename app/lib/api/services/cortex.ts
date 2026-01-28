/**
 * Service API pour le Cortex Thématique
 */

import { apiClient } from '../client';
import { API_CONFIG } from '../config';
import { CortexData, CortexResponse, DEMO_CORTEX_DATA } from '@/app/types/cortex';

/**
 * Récupère les données du Cortex Thématique
 */
export async function getCortexData(
  limit: number = 30,
  minSimilarity: number = 0.4
): Promise<CortexData> {
  try {
    const response = await apiClient.get<CortexResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/cortex-data`,
      {
        params: {
          limit,
          min_similarity: minSimilarity,
        },
      }
    );

    // Vérifier que les données sont valides
    if (response && response.nodes && response.nodes.length > 0) {
      return {
        nodes: response.nodes,
        edges: response.edges || [],
        central_node_id: response.central_node_id || response.nodes[0].id,
        last_updated: response.last_updated || new Date().toISOString(),
      };
    }

    // Fallback vers données demo si pas de données
    console.warn('No cortex data from API, using demo data');
    return DEMO_CORTEX_DATA;
  } catch (error) {
    console.error('Failed to fetch cortex data:', error);
    // Retourner données demo en cas d'erreur
    return DEMO_CORTEX_DATA;
  }
}

/**
 * Service exporté
 */
export const cortexService = {
  getCortexData,
};

export default cortexService;
