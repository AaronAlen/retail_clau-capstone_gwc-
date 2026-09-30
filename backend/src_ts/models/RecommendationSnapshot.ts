import { Schema, model, Document } from "mongoose";

export interface IRecommendationSnapshot extends Document {
  recommendations: any[];
  lastCalculatedAt: Date;
  calculatedBy: {
    userId: string;
    name: string;
    role: string;
  };
  useAI: boolean;
  pairCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSnapshotSchema = new Schema<IRecommendationSnapshot>(
  {
    recommendations: { type: Array, required: true },
    lastCalculatedAt: { type: Date, default: Date.now },
    calculatedBy: {
      userId: { type: String, default: "system" },
      name: { type: String, default: "System" },
      role: { type: String, default: "admin" },
    },
    useAI: { type: Boolean, default: true },
    pairCount: { type: Number, default: 8 },
  },
  { timestamps: true }
);

export default model<IRecommendationSnapshot>("RecommendationSnapshot", recommendationSnapshotSchema);
