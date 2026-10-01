"use strict";
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const Product = require("../models/Product").default || require("../models/Product");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FRONTEND_PRODUCTS_DIR = path.resolve(__dirname, "../../../frontend/public/products");

async function restoreOriginalImages() {
  console.log("🚀 Restoring Original High-Quality Generated Product Images...");
  console.log("📂 Local source directory:", FRONTEND_PRODUCTS_DIR);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB Atlas");

  const products = await Product.find({}).sort({ sku: 1 });
  console.log(`📦 Found ${products.length} products to restore.`);

  let successCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    // Extract product ID (#1 to #60) from name or index
    let id = i + 1;
    const match = product.name.match(/#(\d+)/);
    if (match && match[1]) {
      id = parseInt(match[1], 10);
    }

    const localFileName = `product-${id}.jpg`;
    const localFilePath = path.join(FRONTEND_PRODUCTS_DIR, localFileName);

    if (!fs.existsSync(localFilePath)) {
      console.warn(`⚠️ [${id}/60] Local file not found: ${localFilePath}`);
      continue;
    }

    try {
      console.log(`[${i + 1}/${products.length}] Uploading original ${localFileName} for ${product.name}...`);
      
      const uploadRes = await cloudinary.uploader.upload(localFilePath, {
        folder: "velocity_retail/products",
        public_id: `product-${id}`,
        overwrite: true,
        invalidate: true,
        transformation: [
          { width: 800, height: 800, crop: "fill", quality: "auto", fetch_format: "auto" }
        ]
      });

      product.imageUrl = uploadRes.secure_url;
      await product.save();

      successCount++;
      console.log(`   ✅ Restored to Cloudinary & DB: ${uploadRes.secure_url}`);
    } catch (err) {
      console.error(`   ❌ Failed to upload ${localFileName}:`, err.message || err);
      // Fallback to local path so frontend always loads cleanly
      product.imageUrl = `/products/${localFileName}`;
      await product.save();
    }
  }

  console.log(`\n🎉 Restoration Complete! Successfully restored ${successCount}/${products.length} original generated images.`);
  await mongoose.disconnect();
  process.exit(0);
}

restoreOriginalImages().catch(err => {
  console.error("Fatal error during restoration:", err);
  process.exit(1);
});
