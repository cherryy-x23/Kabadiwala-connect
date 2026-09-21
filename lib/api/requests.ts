import { apiClient, ApiResponse } from '../apiClient';
import { WasteItem } from './waste';

export interface PopulatedRecyclerInfo {
  _id?: string;
  id?: string;
  organizationName: string;
  businessName?: string;
  location?: string;
  address?: string;
  contactPerson?: string;
  registrationId?: string;
  operatingHours?: string;
}

export interface PopulatedCollectorInfo {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  avatar?: string;
}

export interface HandoverRequestItem {
  id: string;
  collectorId: string | PopulatedCollectorInfo;
  recyclerId: string | PopulatedRecyclerInfo;
  recyclerUserId: string;
  wasteItemIds: string[] | WasteItem[];
  totalQuantityKg: number;
  estimatedValue: number;
  status: 'pending' | 'accepted' | 'rejected' | 'scheduled' | 'in_transit' | 'completed' | 'cancelled';
  requestedDate?: string;
  scheduledDate?: string;
  completedAt?: string;
  notes?: string;
  collectorMessage?: string;
  recyclerMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHandoverRequestPayload {
  recyclerId: string;
  wasteItemIds: string[];
  requestedDate?: string;
  notes?: string;
  collectorMessage?: string;
}

export interface RejectRequestPayload {
  reason?: string;
  recyclerMessage?: string;
}

export interface ScheduleRequestPayload {
  scheduledDate: string;
}

export const requestsApi = {
  /**
   * Create a new handover request connecting collector's available waste items to an authorized recycler.
   * Total quantity and estimated value are calculated server-side.
   */
  createRequest: async (payload: CreateHandoverRequestPayload): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>('/requests', payload);
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to create handover request');
    }
    return res.data.request;
  },

  /**
   * Retrieve all handover requests created by the authenticated collector.
   */
  getMyRequests: async (): Promise<HandoverRequestItem[]> => {
    const res = await apiClient.get<ApiResponse<{ requests: HandoverRequestItem[]; count: number }>>('/requests/my');
    return res.data?.requests || [];
  },

  /**
   * Retrieve all incoming handover requests for the authenticated recycler.
   */
  getIncomingRequests: async (): Promise<HandoverRequestItem[]> => {
    const res = await apiClient.get<ApiResponse<{ requests: HandoverRequestItem[]; count: number }>>('/requests/incoming');
    return res.data?.requests || [];
  },

  /**
   * Retrieve a specific handover request by ID.
   */
  getRequestById: async (id: string): Promise<HandoverRequestItem> => {
    const res = await apiClient.get<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}`);
    if (!res.data?.request) {
      throw new Error(res.message || 'Handover request not found');
    }
    return res.data.request;
  },

  /**
   * Collector cancels a pending or accepted handover request.
   */
  cancelRequest: async (id: string): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}/cancel`);
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to cancel request');
    }
    return res.data.request;
  },

  /**
   * Recycler accepts a pending handover request.
   */
  acceptRequest: async (id: string): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}/accept`);
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to accept request');
    }
    return res.data.request;
  },

  /**
   * Recycler rejects a pending handover request.
   */
  rejectRequest: async (id: string, payload?: RejectRequestPayload): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}/reject`, payload || {});
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to reject request');
    }
    return res.data.request;
  },

  /**
   * Recycler schedules a pickup date for an accepted request.
   */
  scheduleRequest: async (id: string, payload: ScheduleRequestPayload): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}/schedule`, payload);
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to schedule request');
    }
    return res.data.request;
  },

  /**
   * Mark a scheduled request as in-transit (accessible by collector or recycler).
   */
  markRequestInTransit: async (id: string): Promise<HandoverRequestItem> => {
    const res = await apiClient.post<ApiResponse<{ request: HandoverRequestItem }>>(`/requests/${id}/in-transit`);
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to mark request in-transit');
    }
    return res.data.request;
  },

  /**
   * Complete an in-transit handover request.
   * Atomically creates Digital Handover Record, Transaction record, and marks items as handed_over.
   */
  completeRequest: async (
    id: string,
    payload?: { notes?: string; collectorConfirmation?: boolean; recyclerConfirmation?: boolean }
  ): Promise<{
    request: HandoverRequestItem;
    handoverRecord: any;
    transaction: any;
  }> => {
    const res = await apiClient.post<
      ApiResponse<{
        request: HandoverRequestItem;
        handoverRecord: any;
        transaction: any;
      }>
    >(`/requests/${id}/complete`, payload || {});
    if (!res.data?.request) {
      throw new Error(res.message || 'Failed to complete handover request');
    }
    return res.data;
  },
};

