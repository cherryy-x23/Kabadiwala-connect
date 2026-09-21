import { apiClient, ApiResponse } from '../apiClient';

export interface ChatMessagePayload {
  message: string;
  sessionId?: string;
}

export interface ChatResponseData {
  sessionId: string;
  message: string;
  provider: string;
  intent: string;
  model?: string;
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  title: string;
  lastIntent: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationDetail {
  id: string;
  sessionId: string;
  title?: string;
  lastIntent?: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface GetConversationsResponse {
  conversations: ConversationSummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const aiApi = {
  /**
   * Send chat message to KabiAI and receive response
   */
  sendMessage: async (payload: ChatMessagePayload): Promise<ChatResponseData> => {
    const res = await apiClient.post<ApiResponse<ChatResponseData>>('/ai/chat', payload);
    if (!res.data) {
      throw new Error(res.message || 'Failed to generate AI response');
    }
    return res.data;
  },

  /**
   * Retrieve list of past conversation sessions for authenticated user
   */
  getConversations: async (page = 1, limit = 20): Promise<GetConversationsResponse> => {
    const res = await apiClient.get<ApiResponse<ConversationSummary[]>>(
      `/ai/conversations?page=${page}&limit=${limit}`
    );
    return {
      conversations: res.data || [],
      pagination: res.pagination,
    };
  },

  /**
   * Retrieve full conversation history by sessionId
   */
  getConversation: async (sessionId: string): Promise<ConversationDetail> => {
    const res = await apiClient.get<ApiResponse<{ conversation: ConversationDetail }>>(
      `/ai/conversations/${encodeURIComponent(sessionId)}`
    );
    if (!res.data?.conversation) {
      throw new Error(res.message || 'Conversation session not found');
    }
    return res.data.conversation;
  },

  /**
   * Delete a conversation session by sessionId
   */
  deleteConversation: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/ai/conversations/${encodeURIComponent(sessionId)}`);
  },
};
