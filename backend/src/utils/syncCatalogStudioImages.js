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
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));

cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const BRAIN_DIR = "C:\\Users\\aaron\\.gemini\\antigravity-ide\\brain\\740eb1ff-df4d-4fd5-96b3-a02a069376d8";
const FRONTEND_PRODUCTS_DIR = path_1.default.resolve(__dirname, "../../../frontend/public/products");
const BACKEND_DIR = path_1.default.resolve(__dirname, "../../");

// 1-to-1 Mapping of all 60 products to high-end studio commercial catalog photography
// Ghost mannequin, luxury hanger, or travertine pedestal on clean off-white background
// Strictly NO clothes on floor, NO wrinkled bedsheets, NO human faces, NO cartoons.
const PRODUCT_STUDIO_MAP = {
  // --- JACKETS (1 - 12) ---
  1: 'navy_blazer_01_1790678383608.jpg',         // Navy Double-Breasted Blazer (Ghost mannequin)
  2: 'beige_overcoat_02_1790678410614.jpg',       // Beige Single-Breasted Overcoat (Ghost mannequin)
  3: 'maroon_blazer_03_1790678448466.jpg',       // Maroon Velvet Evening Blazer (Ghost mannequin)
  4: 'camel_trench_coat_1790674966544.jpg',      // Camel Wool Trench Coat (Ghost mannequin)
  5: 'black_tuxedo_05_1790678476794.jpg',        // Black Executive Tuxedo Jacket (Ghost mannequin)
  6: 'olive_safari_06_1790678503800.jpg',        // Olive Military Safari Jacket (Ghost mannequin)
  7: 'white_linen_07_1790678530363.jpg',         // White Deconstructed Linen Blazer (Ghost mannequin)
  8: 'navy_peacoat_08_1790678555275.jpg',        // Navy Classic Wool Peacoat (Ghost mannequin)
  9: 'charcoal_pinstripe_09_1790678585554.jpg',   // Charcoal Pinstripe Peak Lapel Suit (Ghost mannequin)
  10: 'beige_bomber_10_1790678614604.jpg',       // Beige Suede Trimmed Bomber (Ghost mannequin)
  11: 'olive_hunting_11_1790678676536.jpg',      // Olive Quilted Hunting Jacket (Ghost mannequin)
  12: 'black_blazer_12_1790678720771.jpg',       // Black Tuxedo Blazer (Ghost mannequin)

  // --- JEANS & TROUSERS (13 - 24) ---
  13: 'navy_selvedge_13_1790678764873.jpg',      // Japanese Selvedge Raw Denim (Navy)
  14: 'jeans_black_denim_1790582528716.jpg',     // Tailored Slim Tapered Denim (Black)
  15: 'real_beige_jean_1790504525031.jpg',       // Ecru Washed Minimalist Chino Jeans (Beige)
  16: 'navy_jeans_hero_1790491969586.jpg',       // Deep Indigo Stretch Trousers (Navy)
  17: 'acid_wash_denim_1790676220634.jpg',       // Vintage Faded Wash Straight Leg (Charcoal)
  18: 'olive_utility_denim_1790676762152.jpg',   // Olive Garment-Dyed Utility Denim (Olive)
  19: 'jeans_black_denim_1790582528716.jpg',     // Midnight Rinse Slim Executive Jean (Black)
  20: 'burgundy_raw_denim_1790676790482.jpg',    // Burgundy Tinted Raw Stretch Denim (Maroon)
  21: 'real_beige_jean_1790504525031.jpg',       // Sandstone Washed Relaxed Denim (Beige)
  22: 'navy_jeans_hero_1790491969586.jpg',       // Heavyweight 14oz Heritage Denim (Navy)
  23: 'acid_denim_23_1790677195737.jpg',         // Acid Wash Streetwear Relaxed Denim (Charcoal)
  24: 'white_jeans_hero_1790492308846.jpg',      // Clean Hem Premium Trousers (White/Ecru)

  // --- SHIRTS (25 - 36) ---
  25: 'shirts_white_oxford_1790582962629.jpg',   // Egyptian Cotton Royal Oxford Shirt (White)
  26: 'navy_shirt_hero_1790491945843.jpg',       // Spread Collar Executive Poplin Shirt (Navy)
  27: 'real_beige_shirt_1790504352578.jpg',      // Natural Washed French Linen Shirt (Beige)
  28: 'burgundy_check_shirt_1790676731701.jpg',  // Burgundy Micro-Check Formal Shirt (Maroon)
  29: 'real_olive_shirt_1790504376868.jpg',      // Olive Garment Washed Twill Shirt (Olive)
  30: 'shirts_white_oxford_1790582962629.jpg',   // Crisp Cutaway Collar Dress Shirt (White)
  31: 'shirts_black_dress_1790582918280.jpg',    // Charcoal Herringbone Weave Shirt (Charcoal/Black)
  32: 'navy_shirt_hero_1790491945843.jpg',       // Midnight Navy Luxury Sateen Shirt (Navy)
  33: 'real_beige_shirt_1790504352578.jpg',      // Sand Brushed Cotton Overshirt (Beige)
  34: 'shirts_white_oxford_1790582962629.jpg',   // Grandad Band-Collar Linen Shirt (White)
  35: 'real_olive_shirt_1790504376868.jpg',      // Dark Olive Utility Workshirt (Olive)
  36: 'shirts_black_dress_1790582918280.jpg',    // Sleek Black Concealed Placket Shirt (Black)

  // --- T-SHIRTS (37 - 48) ---
  37: 'temp_white_tee.jpg',                      // Heavyweight Supima Crewneck Tee (White)
  38: 'black_tshirt_hero_1790491922019.jpg',     // Mercerized Cotton Luxury T-Shirt (Black)
  39: 'real_navy_tshirt_1790504422282.jpg',      // Minimalist Typography Graphic Tee (Navy)
  40: 'beige_tshirt_hero_1790492197745.jpg',     // Raw Edge Oversized Studio Tee (Beige)
  41: 'real_olive_tshirt_1790504306944.jpg',     // Olive Earth Wash Heavyweight Tee (Olive)
  42: 'real_maroon_tshirt_1790504399691.jpg',    // Burgundy Signature Chest Print Tee (Maroon)
  43: 'black_tshirt_hero_1790491922019.jpg',     // Charcoal Pigment-Dyed Relaxed Tee (Charcoal/Black)
  44: 'temp_white_tee.jpg',                      // Waffle Knit Long Sleeve Thermal Tee (White)
  45: 'real_navy_tshirt_1790504422282.jpg',      // Deep Navy Embroidered Crest Tee (Navy)
  46: 'black_tshirt_hero_1790491922019.jpg',     // Acid Black Street Graphic Tee (Black)
  47: 'beige_tshirt_hero_1790492197745.jpg',     // Desert Sand High-Density Pocket Tee (Beige)
  48: 'real_olive_tshirt_1790504306944.jpg',     // Vintage Washed Minimalist Crew Tee (Olive)

  // --- SHOES & FOOTWEAR (49 - 60) ---
  49: 'black_shoe_hero_1790492086901.jpg',       // Handcrafted Calfskin Oxford Shoes (Black)
  50: 'shoes_navy_loafer_1790583006041.jpg',     // Italian Suede Penny Loafers (Navy)
  51: 'shoes_beige_brogue_1790583099285.jpg',    // Brogue Cap-Toe Derby Shoes (Beige)
  52: 'shoes_maroon_boot_1790583049965.jpg',     // Burgundy Polished Chelsea Boots (Maroon)
  53: 'white_shoe_hero_1790492032895.jpg',       // Minimalist Leather Low-Top Court Shoes (White)
  54: 'real_olive_shoe_1790504556255.jpg',       // Olive Suede Desert Chukka Boots (Olive)
  55: 'monk_strap_shoes_1790676427532.jpg',      // Monk Strap Hand-Burnished Shoes (Black)
  56: 'driving_loafers_1790676668794.jpg',       // Charcoal Nubuck Driving Loafers (Charcoal)
  57: 'shoes_beige_brogue_1790583099285.jpg',    // Camel Grain Leather Wingtip Brogues (Camel)
  58: 'shoes_navy_loafer_1790583006041.jpg',     // Navy Calfskin Slip-on Sneakers (Navy)
  59: 'military_boot_1790676699430.jpg',         // All-Black Waxed Leather Military Boot (Black)
  60: 'white_shoe_hero_1790492032895.jpg',       // Off-White Platform Cupsole Sneakers (White)
};

async function syncAllStudioImages() {
  console.log("🚀 Starting 100% Studio Catalog Image Sync (Local Files -> Cloudinary -> MongoDB Atlas)...");
  
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGO_URI missing in .env");
  await mongoose_1.default.connect(mongoUri);
  console.log(" Connected to MongoDB Atlas.");

  const products = await Product_1.default.find({}).sort({ sku: 1 });
  console.log(`📦 Found ${products.length} catalog items in database.`);

  if (!fs_1.default.existsSync(FRONTEND_PRODUCTS_DIR)) {
    fs_1.default.mkdirSync(FRONTEND_PRODUCTS_DIR, { recursive: true });
  }

  let successCount = 0;

  for (let id = 1; id <= 60; id++) {
    const product = products.find(p => p.sku === `SKU-${1000 + id}`) || products[id - 1];
    if (!product) {
      console.warn(`⚠️ Could not find product with ID / index ${id}`);
      continue;
    }

    const sourceFilename = PRODUCT_STUDIO_MAP[id];
    let sourcePath = path_1.default.join(BRAIN_DIR, sourceFilename);
    if (!fs_1.default.existsSync(sourcePath)) {
      sourcePath = path_1.default.join(BACKEND_DIR, sourceFilename);
    }

    if (!fs_1.default.existsSync(sourcePath)) {
      console.error(`❌ Source studio image missing for product ${id}: ${sourceFilename}`);
      continue;
    }

    // 1. Copy to frontend/public/products/product-${id}.jpg
    const destLocalPath = path_1.default.join(FRONTEND_PRODUCTS_DIR, `product-${id}.jpg`);
    fs_1.default.copyFileSync(sourcePath, destLocalPath);
    console.log(`[${id}/60] 💾 Copied ${sourceFilename} -> public/products/product-${id}.jpg`);

    // 2. Upload to Cloudinary with overwrite
    try {
      console.log(`       ☁️ Uploading to Cloudinary (velocity_retail/products/product-${id})...`);
      const uploadRes = await cloudinary_1.v2.uploader.upload(destLocalPath, {
        folder: "velocity_retail/products",
        public_id: `product-${id}`,
        overwrite: true,
        invalidate: true,
        transformation: [
          { width: 1000, height: 1000, crop: "fill", quality: "auto", fetch_format: "auto" }
        ]
      });

      // 3. Update MongoDB Product
      product.imageUrl = uploadRes.secure_url;
      await product.save();
      console.log(`       ✅ Database updated: ${uploadRes.secure_url}`);
      successCount++;
    } catch (err) {
      console.error(`       ❌ Cloudinary upload failed for product ${id}:`, err.message);
      // Fallback: set local relative URL in database if Cloudinary fails
      product.imageUrl = `/products/product-${id}.jpg`;
      await product.save();
    }
  }

  console.log(`\n🎉 Completed Studio Photography Sync! Successfully processed ${successCount}/60 products.`);
  await mongoose_1.default.disconnect();
  process.exit(0);
}

syncAllStudioImages().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
