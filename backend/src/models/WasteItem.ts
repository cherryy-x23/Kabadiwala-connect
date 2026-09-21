import mongoose, { Schema, Document, Types } from 'mongoose';

export const WASTE_STATUSES = ['available', 'reserved', 'handed_over'] as const;
export type WasteStatus = typeof WASTE_STATUSES[number];

export interface IWasteItem extends Document {
  collectorId: Types.ObjectId;
  materialId: Types.ObjectId;
  quantityKg: number;
  estimatedValue: number;
  notes?: string;
  photo?: {
    url: string;
    publicId?: string;
  };
  status: WasteStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const wasteItemSchema = new Schema<IWasteItem>(
  {
    collectorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Collector ID is required'],
      index: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
      required: [true, 'Material ID is required'],
      index: true,
    },
    quantityKg: {
      type: Number,
      required: [true, 'Quantity in kg is required'],
      min: [0.01, 'Quantity must be greater than 0 kg'],
    },
    estimatedValue: {
      type: Number,
      required: [true, 'Estimated value is required'],
      min: [0, 'Estimated value cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    photo: {
      url: {
        type: String,
        trim: true,
      },
      publicId: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: {
        values: WASTE_STATUSES,
        message: '{VALUE} is not a valid waste status',
      },
      default: 'available',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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

export const WasteItem = mongoose.model<IWasteItem>('WasteItem', wasteItemSchema);
