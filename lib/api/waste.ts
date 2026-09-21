import { apiClient, ApiResponse } from '../apiClient';

export interface PopulatedMaterial {
  _id?: string;
  id?: string;
  name: string;
  category: string;
  pricePerKg?: number;
  indicativePrice?: number;
  unit?: string;
  priceTrend?: 'up' | 'down' | 'stable';
}

export interface WasteItem {
  id: string;
  collectorId: string;
  materialId: string | PopulatedMaterial;
  quantityKg: number;
  estimatedValue: number;
  notes?: string;
  status: 'available' | 'reserved' | 'handed_over';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWastePayload {
  materialId: string;
  quantityKg: number;
  notes?: string;
}

export const wasteApi = {
  /**
   * Create a new waste item for the authenticated collector.
   * Note: estimatedValue, collectorId, and status are derived and calculated server-side.
   */
  createWasteItem: async (payload: CreateWastePayload): Promise<WasteItem> => {
    const res = await apiClient.post<ApiResponse<{ wasteItem: WasteItem }>>('/waste', payload);
    if (!res.data?.wasteItem) {
      throw new Error(res.message || 'Failed to create waste item');
    }
    return res.data.wasteItem;
  },

  /**
   * Retrieve waste items belonging to the authenticated collector, optionally filtered by status.
   */
  getMyWasteItems: async (status?: 'available' | 'reserved' | 'handed_over'): Promise<WasteItem[]> => {
    const url = status ? `/waste/my?status=${status}` : '/waste/my';
    const res = await apiClient.get<ApiResponse<{ wasteItems: WasteItem[]; count: number }>>(url);
    return res.data?.wasteItems || [];
  },

  /**
   * Retrieve a specific waste item by ID.
   */
  getWasteItemById: async (id: string): Promise<WasteItem> => {
    const res = await apiClient.get<ApiResponse<{ wasteItem: WasteItem }>>(`/waste/${id}`);
    if (!res.data?.wasteItem) {
      throw new Error(res.message || 'Waste item not found');
    }
    return res.data.wasteItem;
  },
};
