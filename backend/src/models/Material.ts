import mongoose, { Schema, Document } from 'mongoose';
import { PRICE_TRENDS, MATERIAL_STATUSES, PriceTrend, MaterialStatus } from '../config/constants';

export interface IMaterial extends Document {
  name: string;
  category: string;
  pricePerKg: number;
  indicativePrice: number;
  unit: string;
  priceTrend: PriceTrend;
  description?: string;
  isActive: boolean;
  status: MaterialStatus;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    name: {
      type: String,
      required: [true, 'Material name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    pricePerKg: {
      type: Number,
      required: [true, 'Price per kg is required'],
      min: [0, 'Price cannot be negative'],
    },
    indicativePrice: {
      type: Number,
      default: function (this: any) {
        return this.pricePerKg;
      },
      min: [0, 'Indicative price cannot be negative'],
    },
    unit: {
      type: String,
      default: 'per kg',
      trim: true,
    },
    priceTrend: {
      type: String,
      enum: {
        values: PRICE_TRENDS,
        message: '{VALUE} is not a valid price trend',
      },
      default: 'stable',
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: MATERIAL_STATUSES,
        message: '{VALUE} is not a valid material status',
      },
      default: 'active',
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

// Pre-validate hook to sync pricePerKg and indicativePrice
materialSchema.pre('validate', function (next) {
  if (this.pricePerKg === undefined && this.indicativePrice !== undefined) {
    this.pricePerKg = this.indicativePrice;
  }
  if (this.indicativePrice === undefined && this.pricePerKg !== undefined) {
    this.indicativePrice = this.pricePerKg;
  }
  if (this.isActive === false) {
    this.status = 'inactive';
  } else if (this.status === 'inactive') {
    this.isActive = false;
  }
  next();
});

export const Material = mongoose.model<IMaterial>('Material', materialSchema);
