import { Schema, model, Document } from "mongoose";

export interface IPlanogram extends Document {
  activePairId: string;
  swapMode?: "cupboard" | "hero_showcase";
  spotId?: string;
  spotName?: string;
  sourceProductId?: string;
  pairedProductId?: string;
  applied: boolean;
  lift: string;
  notes?: string;
  sourceCoordinates?: { x: number; y: number; z: number; zone?: string };
  originalPairedCoordinates?: { x: number; y: number; z: number; zone?: string };
  swappedPairedCoordinates?: { x: number; y: number; z: number; zone?: string };
  suggestedCoordinatesList?: Array<{
    productId: string;
    sku?: string;
    name?: string;
    x: number;
    y: number;
    z: number;
    zone?: string;
  }>;
  updatedAt: Date;
}

const planogramSchema = new Schema<IPlanogram>(
  {
    activePairId: { type: String, default: "sug-1" },
    swapMode: { type: String, enum: ["cupboard", "hero_showcase"], default: "cupboard" },
    spotId: { type: String, default: "cupboard-adjacent" },
    spotName: { type: String, default: "Cupboard Adjacency Placement" },
    sourceProductId: { type: String },
    pairedProductId: { type: String },
    applied: { type: Boolean, default: false },
    lift: { type: String, default: "+82%" },
    notes: { type: String, default: "" },
    sourceCoordinates: {
      x: { type: Number },
      y: { type: Number },
      z: { type: Number },
      zone: { type: String },
    },
    originalPairedCoordinates: {
      x: { type: Number },
      y: { type: Number },
      z: { type: Number },
      zone: { type: String },
    },
    swappedPairedCoordinates: {
      x: { type: Number },
      y: { type: Number },
      z: { type: Number },
      zone: { type: String },
    },
    suggestedCoordinatesList: [
      {
        productId: { type: String },
        sku: { type: String },
        name: { type: String },
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        zone: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default model<IPlanogram>("Planogram", planogramSchema);
