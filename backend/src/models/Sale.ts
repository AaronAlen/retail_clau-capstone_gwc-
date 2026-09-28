import { Schema, model, Document, Types } from "mongoose";

export interface ISale extends Document {
  product: Types.ObjectId;
  quantity: number;
  soldAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    soldAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default model<ISale>("Sale", saleSchema);
