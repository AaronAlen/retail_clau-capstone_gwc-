"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cloudinary_1 = require("cloudinary");
const db_1 = require("../config/db");
const Product_1 = __importDefault(require("../models/Product"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
const FRONTEND_PRODUCTS_DIR = path_1.default.resolve(__dirname, "../../../frontend/public/products");
async function syncToCloudinary() {
    console.log("🚀 Starting Cloudinary Sync for Velocity Retail Catalog...");
    await (0, db_1.connectDB)();
    const products = await Product_1.default.find({}).sort({ sku: 1 });
    console.log(`📦 Found ${products.length} products in database.`);
    let updatedCount = 0;
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        // Find matching local file in frontend/public/products
        let localFileName = "";
        if (product.imageUrl && product.imageUrl.startsWith("/products/")) {
            localFileName = product.imageUrl.replace("/products/", "");
        }
        else {
            const match = product.name.match(/#(\d+)/);
            if (match && match[1]) {
                localFileName = `product-${match[1]}.jpg`;
            }
        }
        if (!localFileName) {
            localFileName = `product-${i + 1}.jpg`;
        }
        const localFilePath = path_1.default.join(FRONTEND_PRODUCTS_DIR, localFileName);
        if (fs_1.default.existsSync(localFilePath)) {
            try {
                console.log(`[${i + 1}/${products.length}] Uploading ${localFileName} for ${product.name}...`);
                const uploadRes = await cloudinary_1.v2.uploader.upload(localFilePath, {
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
            }
            catch (err) {
                console.error(`   ❌ Failed to upload ${localFileName}:`, err.message || err);
            }
        }
        else {
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
//# sourceMappingURL=syncCloudinary.js.map