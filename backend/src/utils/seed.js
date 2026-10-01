"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = require("../config/db");
const User_1 = __importDefault(require("../models/User"));
const Product_1 = __importDefault(require("../models/Product"));
const Sale_1 = __importDefault(require("../models/Sale"));
const Planogram_1 = __importDefault(require("../models/Planogram"));
const updateCoordinates_1 = require("./updateCoordinates");
// 5 core apparel & footwear departments
const categoryData = {
    Jackets: [
        { name: "Tailored Double-Breasted Blazer", color: "Navy", price: 1899 },
        { name: "Cashmere Single-Breasted Overcoat", color: "Beige", price: 2499 },
        { name: "Savile Row Velvet Evening Blazer", color: "Maroon", price: 2199 },
        { name: "Minimalist Italian Wool Trench Coat", color: "Camel", price: 2299 },
        { name: "Structured Executive Tuxedo Jacket", color: "Black", price: 2599 },
        { name: "Military Field Safari Jacket", color: "Olive", price: 1699 },
        { name: "Deconstructed Linen Summer Blazer", color: "White", price: 1799 },
        { name: "Classic Melton Wool Peacoat", color: "Navy", price: 1999 },
        { name: "Pinstripe Peak Lapel Suit Jacket", color: "Charcoal", price: 2399 },
        { name: "Suede Trimmed Bomber Jacket", color: "Beige", price: 1899 },
        { name: "Quilted Heritage Hunting Jacket", color: "Olive", price: 1749 },
        { name: "Slim Fit Wool Tuxedo Blazer", color: "Black", price: 2499 },
    ],
    Jeans: [
        { name: "Japanese Selvedge Raw Denim", color: "Navy", price: 1299 },
        { name: "Tailored Slim Tapered Denim", color: "Black", price: 1199 },
        { name: "Ecru Washed Minimalist Chino Jeans", color: "Beige", price: 1099 },
        { name: "Deep Indigo Stretch Trousers", color: "Navy", price: 1149 },
        { name: "Vintage Faded Wash Straight Leg", color: "Charcoal", price: 1249 },
        { name: "Olive Garment-Dyed Utility Denim", color: "Olive", price: 1199 },
        { name: "Midnight Rinse Slim Executive Jean", color: "Black", price: 1349 },
        { name: "Burgundy Tinted Raw Stretch Denim", color: "Maroon", price: 1299 },
        { name: "Sandstone Washed Relaxed Denim", color: "Beige", price: 1099 },
        { name: "Heavyweight 14oz Heritage Denim", color: "Navy", price: 1449 },
        { name: "Acid Wash Streetwear Relaxed Denim", color: "Charcoal", price: 1199 },
        { name: "Clean Hem Premium Black Trousers", color: "Black", price: 1299 },
    ],
    Shirts: [
        { name: "Egyptian Cotton Royal Oxford Shirt", color: "White", price: 899 },
        { name: "Spread Collar Executive Poplin Shirt", color: "Navy", price: 849 },
        { name: "Natural Washed French Linen Shirt", color: "Beige", price: 949 },
        { name: "Burgundy Micro-Check Formal Shirt", color: "Maroon", price: 899 },
        { name: "Olive Garment Washed Twill Shirt", color: "Olive", price: 829 },
        { name: "Crisp Cutaway Collar Dress Shirt", color: "White", price: 999 },
        { name: "Charcoal Herringbone Weave Shirt", color: "Charcoal", price: 879 },
        { name: "Midnight Navy Luxury Sateen Shirt", color: "Navy", price: 929 },
        { name: "Sand Brushed Cotton Overshirt", color: "Beige", price: 1049 },
        { name: "Grandad Band-Collar Linen Shirt", color: "White", price: 899 },
        { name: "Dark Olive Utility Workshirt", color: "Olive", price: 879 },
        { name: "Sleek Black Concealed Placket Shirt", color: "Black", price: 949 },
    ],
    "T-Shirts": [
        { name: "Heavyweight Supima Crewneck Tee", color: "White", price: 549 },
        { name: "Mercerized Cotton Luxury T-Shirt", color: "Black", price: 599 },
        { name: "Minimalist Typography Graphic Tee", color: "Navy", price: 649 },
        { name: "Raw Edge Oversized Studio Tee", color: "Beige", price: 599 },
        { name: "Olive Earth Wash Heavyweight Tee", color: "Olive", price: 579 },
        { name: "Burgundy Signature Chest Print Tee", color: "Maroon", price: 629 },
        { name: "Charcoal Pigment-Dyed Relaxed Tee", color: "Charcoal", price: 599 },
        { name: "Waffle Knit Long Sleeve Thermal Tee", color: "White", price: 699 },
        { name: "Deep Navy Embroidered Crest Tee", color: "Navy", price: 649 },
        { name: "Acid Black Street Graphic Tee", color: "Black", price: 679 },
        { name: "Desert Sand High-Density Pocket Tee", color: "Beige", price: 589 },
        { name: "Vintage Washed Minimalist Crew Tee", color: "Olive", price: 569 },
    ],
    Shoes: [
        { name: "Handcrafted Calfskin Oxford Shoes", color: "Black", price: 2199 },
        { name: "Italian Suede Penny Loafers", color: "Navy", price: 1899 },
        { name: "Brogue Cap-Toe Derby Shoes", color: "Beige", price: 1999 },
        { name: "Burgundy Polished Chelsea Boots", color: "Maroon", price: 2399 },
        { name: "Minimalist Leather Low-Top Court Shoes", color: "White", price: 1699 },
        { name: "Olive Suede Desert Chukka Boots", color: "Olive", price: 1849 },
        { name: "Monk Strap Hand-Burnished Shoes", color: "Black", price: 2299 },
        { name: "Charcoal Nubuck Driving Loafers", color: "Charcoal", price: 1799 },
        { name: "Camel Grain Leather Wingtip Brogues", color: "Camel", price: 2099 },
        { name: "Navy Calfskin Slip-on Sneakers", color: "Navy", price: 1599 },
        { name: "All-Black Waxed Leather Military Boot", color: "Black", price: 2499 },
        { name: "Off-White Platform Cupsole Sneakers", color: "White", price: 1649 },
    ],
};
const run = async () => {
    await (0, db_1.connectDB)();
    await Promise.all([
        User_1.default.deleteMany({}),
        Product_1.default.deleteMany({}),
        Sale_1.default.deleteMany({}),
        Planogram_1.default.deleteMany({}),
    ]);
    await User_1.default.create([
        { name: "Admin", email: "admin@velocity.com", password: "Velocity@Admin2026!", role: "admin" },
        { name: "Manager", email: "manager@velocity.com", password: "Velocity@Mgr2026!", role: "manager" },
        { name: "Staff", email: "staff@velocity.com", password: "Velocity@Staff2026!", role: "staff" },
    ]);
    const products = [];
    let skuCounter = 1001;
    for (const [category, items] of Object.entries(categoryData)) {
        let indexInCat = 0;
        for (const item of items) {
            const sku = `SKU-${skuCounter++}`;
            // Set varying inventory buffer: some with high stock, a couple with low stock for alerts
            const stock = skuCounter % 15 === 0 ? 3 : 18 + (skuCounter % 7) * 6;
            const coords = (0, updateCoordinates_1.computeProductCoordinates)(category, indexInCat++);
            products.push({
                name: `${item.name} #${skuCounter - 1001}`,
                sku,
                category,
                color: item.color,
                tags: [category.toLowerCase(), item.color.toLowerCase(), "luxury", "flagship"],
                price: item.price,
                stock,
                imageUrl: process.env.CLOUDINARY_CLOUD_NAME
                    ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/velocity_retail/products/product-${skuCounter - 1001}.jpg`
                    : `/products/product-${skuCounter - 1001}.jpg`,
                coordinates3D: coords,
            });
        }
    }
    const createdProducts = await Product_1.default.insertMany(products);
    const sales = [];
    const now = Date.now();
    for (let i = 0; i < createdProducts.length; i++) {
        const product = createdProducts[i];
        // Create realistic velocity spectrum:
        // Fast movers: index % 6 === 0 -> 25-45 units sold over 7 days (~3.5 to 6.5 units/day)
        // Hero Fast Mover: product.sku === "SKU-1002" or "SKU-1014" -> ~10 units/day
        const isHeroMover = product.sku === "SKU-1002" || product.sku === "SKU-1014";
        const isFastMover = isHeroMover || i % 6 === 0;
        let saleCount = 2 + (i % 4);
        if (isFastMover)
            saleCount = 18 + Math.floor(Math.random() * 12);
        if (isHeroMover)
            saleCount = 38 + Math.floor(Math.random() * 8);
        for (let s = 0; s < saleCount; s++) {
            const daysAgo = Math.floor(Math.random() * 7);
            sales.push({
                product: product._id,
                quantity: 1 + (s % 3 === 0 ? 1 : 0),
                soldAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 86400000),
            });
        }
    }
    await Sale_1.default.insertMany(sales);
    // Initialize initial Planogram state in MongoDB
    const anchorProduct = createdProducts.find((p) => p.sku === "SKU-1002") || createdProducts[1];
    const pairedProduct = createdProducts.find((p) => p.sku === "SKU-1014") || createdProducts[13];
    await Planogram_1.default.create({
        activePairId: "sug-1",
        sourceProductId: String(anchorProduct._id),
        pairedProductId: String(pairedProduct._id),
        applied: false,
        lift: "+82%",
        notes: "Outerwear + Contrast Denim co-purchase basket synergy.",
    });
    console.log(`✓ Seeded ${createdProducts.length} luxury products across 5 categories.`);
    console.log(`✓ Seeded ${sales.length} transactions across rolling 7-day velocity model.`);
    console.log(`✓ Initialized 3D Planogram DB state.`);
    console.log("Login: admin@velocity.com / admin123");
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map