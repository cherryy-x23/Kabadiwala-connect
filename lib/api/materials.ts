import { apiClient, ApiResponse } from '../apiClient';
import { Material } from '@/data/mockData';

export interface BackendMaterial {
  id: string;
  name: string;
  category: string;
  pricePerKg?: number;
  indicativePrice?: number;
  unit?: string;
  priceTrend?: 'up' | 'down' | 'stable';
  description?: string;
  acceptedByRecyclers?: number;
  isActive?: boolean;
}

export const materialsApi = {
  /**
   * Fetch materials catalog from backend
   */
  getMaterials: async (category?: string): Promise<Material[]> => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await apiClient.get<ApiResponse<{ materials: BackendMaterial[]; count: number }>>(
      `/materials${query}`
    );

    const backendList = res.data?.materials || [];

    // Map backend material documents into the frontend Material interface
    return backendList.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      indicativePrice: m.pricePerKg ?? m.indicativePrice ?? 0,
      unit: m.unit || 'per kg',
      priceTrend: m.priceTrend || 'stable',
      description: m.description,
      acceptedByRecyclers: m.acceptedByRecyclers ?? 12,
    }));
  },
};
