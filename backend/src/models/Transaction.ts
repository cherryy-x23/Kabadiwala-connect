import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  handoverRecordId: Types.ObjectId;
  handoverRequestId: Types.ObjectId;
  collectorId: Types.ObjectId;
  recyclerId: Types.ObjectId;
  recyclerUserId: Types.ObjectId;
  amount: number;
  currency: string;
  status: 'completed' | 'pending';
  transactionReference: string;
  transactionDate: Date;
  paymentMethod: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function generateTransactionReference(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestampPart = Date.now().toString().slice(-4);
  return `TXN-${year}-${randomPart}${timestampPart}`;
}

const transactionSchema = new Schema<ITransaction>(
  {
    handoverRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'HandoverRecord',
      required: [true, 'Handover record ID is required'],
      unique: true,
      index: true,
    },
    handoverRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'HandoverRequest',
      required: [true, 'Handover request ID is required'],
      index: true,
    },
    collectorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Collector ID is required'],
      index: true,
    },
    recyclerId: {
      type: Schema.Types.ObjectId,
      ref: 'RecyclerProfile',
      required: [true, 'Recycler profile ID is required'],
      index: true,
    },
    recyclerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recycler user ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['completed', 'pending'],
      default: 'completed',
      index: true,
    },
    transactionReference: {
      type: String,
      required: [true, 'Transaction reference is required'],
      unique: true,
      trim: true,
      index: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'simulated_settlement',
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
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

transactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>(
  'Transaction',
  transactionSchema
);
