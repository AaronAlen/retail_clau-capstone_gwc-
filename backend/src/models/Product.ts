import { Schema, model, Document, Types } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  category: string;
  color: string;
  tags: string[];
  price: number;
  stock: number;
  imageUrl?: string;
  coordinates3D?: {
    x: number;
    y: number;
    z: number;
    zone?: string;
    shelf?: string;
    slot?: number;
    isRelocated?: boolean;
  };
  createdAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true },
    color: { type: String, required: true, index: true },
    tags: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String },
    coordinates3D: {
      x: { type: Number },
      y: { type: Number },
      z: { type: Number },
      zone: { type: String },
      shelf: { type: String },
      slot: { type: Number },
      isRelocated: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, color: 1 });

export default model<IProduct>("Product", productSchema);
