import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { connectDB } from "../config/db";
import Product from "../models/Product";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FRONTEND_PRODUCTS_DIR = path.resolve(__dirname, "../../../frontend/public/products");

async function syncToCloudinary() {
  console.log("🚀 Starting Cloudinary Sync for Velocity Retail Catalog...");
  await connectDB();

  const products = await Product.find({}).sort({ sku: 1 });
  console.log(`📦 Found ${products.length} products in database.`);

  let updatedCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    // Find matching local file in frontend/public/products
    let localFileName = "";
    if (product.imageUrl && product.imageUrl.startsWith("/products/")) {
      localFileName = product.imageUrl.replace("/products/", "");
    } else {
      const match = product.name.match(/#(\d+)/);
      if (match && match[1]) {
        localFileName = `product-${match[1]}.jpg`;
      }
    }

    if (!localFileName) {
      localFileName = `product-${i + 1}.jpg`;
    }

    const localFilePath = path.join(FRONTEND_PRODUCTS_DIR, localFileName);

    if (fs.existsSync(localFilePath)) {
      try {
        console.log(`[${i + 1}/${products.length}] Uploading ${localFileName} for ${product.name}...`);
        const uploadRes = await cloudinary.uploader.upload(localFilePath, {
          folder: "velocity_retail/products",
          public_id: `product-${i + 1}`,
          overwrite: true,
          transformation: [
            { width: 800, height: 800, crop: "fill", quality: "auto", fetch_format: "auto" }
          ]
        });

        product.imageUrl = uploadRes.secure_url;
        await product.save();
        updatedCount++;
        console.log(`   ✅ Cloudinary URL: ${uploadRes.secure_url}`);
      } catch (err: any) {
        console.error(`   ❌ Failed to upload ${localFileName}:`, err.message || err);
      }
    } else {
      console.warn(`   ⚠️ File not found locally: ${localFilePath}`);
    }
  }

  console.log(`\n🎉 Sync Completed! Updated ${updatedCount}/${products.length} products with Cloudinary CDN URLs.`);
  process.exit(0);
}

syncToCloudinary().catch((err) => {
  console.error("Fatal sync error:", err);
  process.exit(1);
});
