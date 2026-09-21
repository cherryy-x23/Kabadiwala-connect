import mongoose, { Schema, Document, Types } from 'mongoose';

export const HANDOVER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'scheduled',
  'in_transit',
  'completed',
  'cancelled',
] as const;

export type HandoverStatus = typeof HANDOVER_STATUSES[number];

export interface IHandoverRequest extends Document {
  collectorId: Types.ObjectId;
  recyclerId: Types.ObjectId;      // References RecyclerProfile
  recyclerUserId: Types.ObjectId;  // References User (for quick auth lookup)
  wasteItemIds: Types.ObjectId[];
  materialIds: Types.ObjectId[];
  totalQuantityKg: number;
  estimatedValue: number;
  requestedDate?: Date;
  scheduledDate?: Date;
  notes?: string;
  collectorMessage?: string;
  recyclerMessage?: string;
  status: HandoverStatus;
  createdAt: Date;
  updatedAt: Date;
}

const handoverRequestSchema = new Schema<IHandoverRequest>(
  {
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
      required: [true, 'Recycler User ID is required'],
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
      required: [true, 'Total quantity is required'],
      min: [0.01, 'Total quantity must be greater than 0 kg'],
    },
    estimatedValue: {
      type: Number,
      required: [true, 'Estimated value is required'],
      min: [0, 'Estimated value cannot be negative'],
    },
    requestedDate: {
      type: Date,
    },
    scheduledDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    collectorMessage: {
      type: String,
      trim: true,
      maxlength: [500, 'Collector message cannot exceed 500 characters'],
    },
    recyclerMessage: {
      type: String,
      trim: true,
      maxlength: [500, 'Recycler message cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: HANDOVER_STATUSES,
        message: '{VALUE} is not a valid handover status',
      },
      default: 'pending',
      index: true,
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

// Indexes to speed up queries and duplicate-request checks
handoverRequestSchema.index({ wasteItemIds: 1, status: 1 });
handoverRequestSchema.index({ createdAt: -1 });

export const HandoverRequest = mongoose.model<IHandoverRequest>(
  'HandoverRequest',
  handoverRequestSchema
);
