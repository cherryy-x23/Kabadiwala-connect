import { apiClient, ApiResponse } from '../apiClient';
import { PopulatedCollectorInfo, PopulatedRecyclerInfo } from './requests';
import { HandoverRecordItem } from './handovers';

export interface TransactionItem {
  id: string;
  handoverRecordId: string | HandoverRecordItem;
  handoverRequestId: string;
  collectorId: string | PopulatedCollectorInfo;
  recyclerId: string | PopulatedRecyclerInfo;
  recyclerUserId: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending';
  transactionReference: string;
  transactionDate: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const transactionsApi = {
  /**
   * Retrieve all transaction settlement records for the authenticated collector.
   */
  getMyTransactions: async (): Promise<TransactionItem[]> => {
    const res = await apiClient.get<ApiResponse<{ transactions: TransactionItem[]; count: number }>>(
      '/transactions/my'
    );
    return res.data?.transactions || [];
  },

  /**
   * Retrieve all transaction settlement records for the authenticated recycler.
   */
  getIncomingTransactions: async (): Promise<TransactionItem[]> => {
    const res = await apiClient.get<ApiResponse<{ transactions: TransactionItem[]; count: number }>>(
      '/transactions/incoming'
    );
    return res.data?.transactions || [];
  },

  /**
   * Retrieve a specific transaction settlement record by transaction ID or associated record/request ID.
   */
  getTransactionById: async (id: string): Promise<TransactionItem> => {
    const res = await apiClient.get<ApiResponse<{ transaction: TransactionItem }>>(
      `/transactions/${id}`
    );
    if (!res.data?.transaction) {
      throw new Error(res.message || 'Transaction record not found');
    }
    return res.data.transaction;
  },
};
