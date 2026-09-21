import crypto from 'crypto';
import { Types } from 'mongoose';
import { AIConversation, IAIConversation } from '../models/AIConversation';
import { getAIProvider, AIProviderResponse } from './aiProvider';

export type AIIntent =
  | 'platform_help'
  | 'material_info'
  | 'handover_help'
  | 'recycler_help'
  | 'transaction_help'
  | 'account_help'
  | 'general';

const MAX_STORED_MESSAGES = 100;

/**
 * Basic intent classification based on user message content
 */
export const determineIntent = (message: string): AIIntent => {
  const lower = message.toLowerCase();

  if (
    lower.includes('handover') ||
    lower.includes('hand over') ||
    lower.includes('process') ||
    lower.includes('schedule') ||
    lower.includes('pickup') ||
    lower.includes('in-transit') ||
    lower.includes('in transit') ||
    lower.includes('status')
  ) {
    return 'handover_help';
  }

  if (
    lower.includes('material') ||
    lower.includes('price') ||
    lower.includes('rate') ||
    lower.includes('sell') ||
    lower.includes('motherboard') ||
    lower.includes('battery') ||
    lower.includes('cable') ||
    lower.includes('waste') ||
    lower.includes('scrap')
  ) {
    return 'material_info';
  }

  if (
    lower.includes('recycler') ||
    lower.includes('facility') ||
    lower.includes('center') ||
    lower.includes('find recycler') ||
    lower.includes('contact')
  ) {
    return 'recycler_help';
  }

  if (
    lower.includes('transaction') ||
    lower.includes('payment') ||
    lower.includes('money') ||
    lower.includes('earnings') ||
    lower.includes('paid') ||
    lower.includes('receipt')
  ) {
    return 'transaction_help';
  }

  if (
    lower.includes('account') ||
    lower.includes('profile') ||
    lower.includes('collector') ||
    lower.includes('role') ||
    lower.includes('login')
  ) {
    return 'account_help';
  }

  if (
    lower.includes('kabadiwala') ||
    lower.includes('about the platform') ||
    lower.includes('about kabadiwala') ||
    lower.includes('about this app') ||
    lower.includes('about the app') ||
    lower.includes('what is kabadiwala') ||
    lower.includes('how does the platform work') ||
    lower.includes('how does this work')
  ) {
    return 'platform_help';
  }

  return 'general';
};

export interface ProcessChatParams {
  userId: string;
  userRole?: string;
  message: string;
  sessionId?: string;
}

export interface ChatResponseData {
  sessionId: string;
  message: string;
  provider: string;
  intent: AIIntent;
  model?: string;
}

/**
 * Process an incoming chat message, invoke the AI provider, and update conversation history
 */
export const processChatMessage = async (
  params: ProcessChatParams
): Promise<ChatResponseData> => {
  const { userId, userRole, message } = params;
  const trimmedMessage = message.trim();

  // Generate or use existing sessionId
  const sessionId =
    params.sessionId?.trim() || `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Determine intent
  const intent = determineIntent(trimmedMessage);

  // Build safe context (strictly exclude any tokens, password hashes, secrets, or internal DB credentials)
  const safeContext: Record<string, any> = {
    userRole: userRole || 'user',
    intent,
    timestamp: new Date(),
  };

  // Generate AI response via provider abstraction
  const provider = getAIProvider();
  const aiResponse: AIProviderResponse = await provider.generateResponse(
    trimmedMessage,
    safeContext
  );

  // Find or create the conversation document
  let conversation = await AIConversation.findOne({
    userId: new Types.ObjectId(userId),
    sessionId,
  });

  const now = new Date();

  if (!conversation) {
    // New conversation session
    const titleSnippet =
      trimmedMessage.length > 50 ? `${trimmedMessage.substring(0, 47)}...` : trimmedMessage;

    conversation = new AIConversation({
      userId: new Types.ObjectId(userId),
      sessionId,
      title: titleSnippet,
      lastIntent: intent,
      messages: [
        {
          role: 'user',
          content: trimmedMessage,
          timestamp: now,
        },
        {
          role: 'assistant',
          content: aiResponse.message,
          timestamp: now,
        },
      ],
    });
  } else {
    // Existing conversation session
    conversation.lastIntent = intent;
    conversation.messages.push({
      role: 'user',
      content: trimmedMessage,
      timestamp: now,
    });
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse.message,
      timestamp: now,
    });

    // Enforce message history cap to prevent unbounded growth
    if (conversation.messages.length > MAX_STORED_MESSAGES) {
      conversation.messages = conversation.messages.slice(-MAX_STORED_MESSAGES);
    }
  }

  await conversation.save();

  return {
    sessionId,
    message: aiResponse.message,
    provider: aiResponse.provider,
    intent,
    model: aiResponse.model,
  };
};

/**
 * Retrieve paginated conversations for the authenticated user
 */
export const getUserConversations = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<{
  conversations: any[];
  total: number;
  totalPages: number;
}> => {
  const filter = { userId: new Types.ObjectId(userId) };

  const total = await AIConversation.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const docs = await AIConversation.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  // Map to summaries with message count
  const conversations = docs.map((doc) => ({
    id: doc.id,
    sessionId: doc.sessionId,
    title: doc.title || 'Conversation',
    lastIntent: doc.lastIntent || 'general',
    messageCount: doc.messages.length,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return {
    conversations,
    total,
    totalPages,
  };
};

/**
 * Retrieve full conversation by sessionId for the authenticated user
 */
export const getConversationBySessionId = async (
  userId: string,
  sessionId: string
): Promise<IAIConversation | null> => {
  return AIConversation.findOne({
    userId: new Types.ObjectId(userId),
    sessionId,
  });
};

/**
 * Delete a user's conversation session
 */
export const deleteConversationBySessionId = async (
  userId: string,
  sessionId: string
): Promise<boolean> => {
  const result = await AIConversation.deleteOne({
    userId: new Types.ObjectId(userId),
    sessionId,
  });

  return result.deletedCount > 0;
};
