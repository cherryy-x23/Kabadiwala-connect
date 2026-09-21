import { apiClient, ApiResponse } from '../apiClient';
import { WasteItem } from './waste';
import { PopulatedCollectorInfo, PopulatedRecyclerInfo } from './requests';

export interface HandoverRecordItem {
  id: string;
  handoverRequestId: string;
  collectorId: string | PopulatedCollectorInfo;
  recyclerId: string | PopulatedRecyclerInfo;
  recyclerUserId: string;
  wasteItemIds: string[] | WasteItem[];
  materialIds?: string[];
  totalQuantityKg: number;
  finalValue: number;
  completedAt: string;
  handoverReference: string;
  collectorConfirmation: boolean;
  recyclerConfirmation: boolean;
  notes?: string;
  completedBy: string;
  completedByRole: 'collector' | 'recycler';
  createdAt: string;
  updatedAt: string;
}

export const handoversApi = {
  /**
   * Retrieve all digital handover records for the authenticated collector.
   */
  getMyHandoverRecords: async (): Promise<HandoverRecordItem[]> => {
    const res = await apiClient.get<ApiResponse<{ records: HandoverRecordItem[]; count: number }>>(
      '/handover-records/my'
    );
    return res.data?.records || [];
  },

  /**
   * Retrieve all digital handover records for the authenticated recycler.
   */
  getIncomingHandoverRecords: async (): Promise<HandoverRecordItem[]> => {
    const res = await apiClient.get<ApiResponse<{ records: HandoverRecordItem[]; count: number }>>(
      '/handover-records/incoming'
    );
    return res.data?.records || [];
  },

  /**
   * Retrieve a specific digital handover record by record ID or associated request ID.
   */
  getHandoverRecordById: async (id: string): Promise<HandoverRecordItem> => {
    const res = await apiClient.get<ApiResponse<{ record: HandoverRecordItem }>>(
      `/handover-records/${id}`
    );
    if (!res.data?.record) {
      throw new Error(res.message || 'Handover record not found');
    }
    return res.data.record;
  },
};
