import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IHandoverRecord extends Document {
  handoverRequestId: Types.ObjectId;
  collectorId: Types.ObjectId;
  recyclerId: Types.ObjectId;
  recyclerUserId: Types.ObjectId;
  wasteItemIds: Types.ObjectId[];
  materialIds: Types.ObjectId[];
  totalQuantityKg: number;
  finalValue: number;
  completedAt: Date;
  handoverReference: string;
  collectorConfirmation: boolean;
  recyclerConfirmation: boolean;
  notes?: string;
  completedBy: Types.ObjectId;
  completedByRole: 'collector' | 'recycler';
  createdAt: Date;
  updatedAt: Date;
}

export function generateHandoverReference(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestampPart = Date.now().toString().slice(-4);
  return `KBC-${year}-${randomPart}${timestampPart}`;
}

const handoverRecordSchema = new Schema<IHandoverRecord>(
  {
    handoverRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'HandoverRequest',
      required: [true, 'Handover request ID is required'],
      unique: true,
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
    wasteItemIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'WasteItem',
        required: true,
      },
    ],
    materialIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
      },
    ],
    totalQuantityKg: {
      type: Number,
      required: [true, 'Total quantity in kg is required'],
      min: [0.01, 'Quantity must be greater than 0 kg'],
    },
    finalValue: {
      type: Number,
      required: [true, 'Final value is required'],
      min: [0, 'Final value cannot be negative'],
    },
    completedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    handoverReference: {
      type: String,
      required: [true, 'Handover reference is required'],
      unique: true,
      trim: true,
      index: true,
    },
    collectorConfirmation: {
      type: Boolean,
      default: true,
    },
    recyclerConfirmation: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Completed by user ID is required'],
    },
    completedByRole: {
      type: String,
      enum: ['collector', 'recycler'],
      required: true,
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

handoverRecordSchema.index({ createdAt: -1 });

export const HandoverRecord = mongoose.model<IHandoverRecord>(
  'HandoverRecord',
  handoverRecordSchema
);
