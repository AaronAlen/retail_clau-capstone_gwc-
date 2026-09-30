"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProductCoordinates = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const MONGO_URI = process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "";
const computeProductCoordinates = (category, indexInCat) => {
    const cat = (category || "").toLowerCase();
    // 1. Jackets (West Wing, x center: -12.5, z: -3.8)
    if (cat.includes("jacket")) {
        const shelfIndex = Math.floor(indexInCat / 4); // 0 = Top, 1 = Middle, 2 = Lower
        const colIndex = indexInCat % 4; // 0, 1, 2, 3
        const x = -14.0 + colIndex * 1.0;
        const y = shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0;
        const shelfName = shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf";
        return {
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            z: -3.8,
            zone: "West Wing: Executive Outerwear Cupboard",
            shelf: shelfName,
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    // 2. Shirts (North-West Wing, x center: -12.5, z: 6.2)
    if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        const x = -14.0 + colIndex * 1.0;
        const y = shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0;
        const shelfName = shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf";
        return {
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            z: 6.2,
            zone: "North-West: Formal Shirts Wardrobe",
            shelf: shelfName,
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    // 3. Jeans (East Wing, x center: 12.5, z: -3.8)
    if (cat.includes("jean") || cat.includes("denim") || cat.includes("trouser")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        const x = 11.0 + colIndex * 1.0;
        const y = shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0;
        const shelfName = shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf";
        return {
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            z: -3.8,
            zone: "East Wing: Premium Denim Cupboard",
            shelf: shelfName,
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    // 4. T-Shirts (North-East Wing, x center: 12.5, z: 6.2)
    if (cat.includes("t-shirt") || cat.includes("tee")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        const x = 11.0 + colIndex * 1.0;
        const y = shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0;
        const shelfName = shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf";
        return {
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            z: 6.2,
            zone: "North-East: Streetwear Tees Cupboard",
            shelf: shelfName,
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    // 5. Footwear / Shoes (Center North Gallery)
    // 6 on upper tier, 6 on lower tier
    const isUpper = indexInCat < 6;
    const colIndex = isUpper ? indexInCat : indexInCat - 6;
    const x = -5.0 + colIndex * 2.0; // -5, -3, -1, 1, 3, 5
    const y = isUpper ? 1.8 : 0.9;
    const z = isUpper ? -12.0 : -10.0;
    return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        zone: "Center Arcade: Footwear Vitrine Gallery",
        shelf: isUpper ? "Upper Vitrine Tier" : "Lower Vitrine Tier",
        slot: indexInCat + 1,
        isRelocated: false,
    };
};
exports.computeProductCoordinates = computeProductCoordinates;

const resetAllProductsToBaselineCoords = async () => {
    try {
        const productsCollection = mongoose_1.default.connection.collection("products");
        const products = await productsCollection.find({}).sort({ sku: 1 }).toArray();
        const categories = ["Jackets", "Jeans", "Shirts", "T-Shirts", "Shoes"];
        for (const cat of categories) {
            const catProducts = products.filter((p) => p.category === cat);
            for (let i = 0; i < catProducts.length; i++) {
                const prod = catProducts[i];
                const coords = computeProductCoordinates(cat, i);
                await productsCollection.updateOne({ _id: prod._id }, {
                    $set: {
                        coordinates3D: coords,
                    },
                });
            }
        }
        return true;
    } catch (err) {
        console.error("Failed to reset products to baseline coords:", err);
        return false;
    }
};
exports.resetAllProductsToBaselineCoords = resetAllProductsToBaselineCoords;

const runMigration = async () => {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose_1.default.connect(MONGO_URI);
    console.log("Connected to MongoDB Atlas.");
    const productsCollection = mongoose_1.default.connection.collection("products");
    const products = await productsCollection.find({}).sort({ sku: 1 }).toArray();
    console.log(`Found ${products.length} products to update with 3D showroom coordinates.`);
    const categories = ["Jackets", "Jeans", "Shirts", "T-Shirts", "Shoes"];
    let updatedCount = 0;
    for (const cat of categories) {
        const catProducts = products.filter((p) => p.category === cat);
        for (let i = 0; i < catProducts.length; i++) {
            const prod = catProducts[i];
            const coords = (0, exports.computeProductCoordinates)(cat, i);
            await productsCollection.updateOne({ _id: prod._id }, {
                $set: {
                    coordinates3D: coords,
                },
            });
            updatedCount++;
        }
    }
    console.log(`✓ Successfully updated coordinates3D for all ${updatedCount} products in MongoDB Atlas!`);
    // Verify the update
    const sampleProducts = await productsCollection.find({}).limit(5).toArray();
    sampleProducts.forEach((p) => {
        console.log(`- ${p.sku} | ${p.name} -> x: ${p.coordinates3D?.x}, y: ${p.coordinates3D?.y}, z: ${p.coordinates3D?.z}, zone: ${p.coordinates3D?.zone}, shelf: ${p.coordinates3D?.shelf}`);
    });
    await mongoose_1.default.disconnect();
    console.log("Database disconnected.");
    process.exit(0);
};
if (require.main === module) {
    runMigration().catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=updateCoordinates.js.map