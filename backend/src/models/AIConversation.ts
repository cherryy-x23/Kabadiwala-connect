import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IAIConversation extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  title?: string;
  lastIntent?: string;
  messages: IAIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const aiMessageSchema = new Schema<IAIMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [4000, 'Message content cannot exceed 4000 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const aiConversationSchema = new Schema<IAIConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      trim: true,
      maxlength: [100, 'Session ID cannot exceed 100 characters'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    lastIntent: {
      type: String,
      trim: true,
      maxlength: [50, 'Intent cannot exceed 50 characters'],
    },
    messages: {
      type: [aiMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
aiConversationSchema.index({ userId: 1, updatedAt: -1 });
aiConversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export const AIConversation = mongoose.model<IAIConversation>(
  'AIConversation',
  aiConversationSchema
);
