"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
const mongoose_1 = __importDefault(require("mongoose"));
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";

const computeProductCoordinates = (category, indexInCat) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("jacket")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        return {
            x: Number((-14.0 + colIndex * 1.0).toFixed(2)),
            y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
            z: -3.8,
            zone: "West Wing: Executive Outerwear Cupboard",
            shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        return {
            x: Number((-14.0 + colIndex * 1.0).toFixed(2)),
            y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
            z: 6.2,
            zone: "North-West: Formal Shirts Wardrobe",
            shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    if (cat.includes("jean") || cat.includes("denim") || cat.includes("trouser")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        return {
            x: Number((11.0 + colIndex * 1.0).toFixed(2)),
            y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
            z: -3.8,
            zone: "East Wing: Premium Denim Cupboard",
            shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    if (cat.includes("t-shirt") || cat.includes("tee")) {
        const shelfIndex = Math.floor(indexInCat / 4);
        const colIndex = indexInCat % 4;
        return {
            x: Number((11.0 + colIndex * 1.0).toFixed(2)),
            y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
            z: 6.2,
            zone: "North-East: Streetwear Tees Cupboard",
            shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
            slot: indexInCat + 1,
            isRelocated: false,
        };
    }
    // Shoes
    const isUpper = indexInCat < 6;
    const colIndex = isUpper ? indexInCat : indexInCat - 6;
    return {
        x: Number((-5.0 + colIndex * 2.0).toFixed(2)),
        y: isUpper ? 1.8 : 0.9,
        z: isUpper ? -12.0 : -10.0,
        zone: "Center Arcade: Footwear Vitrine Gallery",
        shelf: isUpper ? "Upper Vitrine Tier" : "Lower Vitrine Tier",
        slot: indexInCat + 1,
        isRelocated: false,
    };
};

const cleanStoreState = async () => {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose_1.default.connect(MONGO_URI);
    const db = mongoose_1.default.connection.db;

    console.log("1. Cleaning up all 60 products to exact baseline coordinates...");
    const products = await db.collection("products").find({}).sort({ sku: 1 }).toArray();
    const categories = ["Jackets", "Jeans", "Shirts", "T-Shirts", "Shoes"];
    let count = 0;
    for (const cat of categories) {
        const catProds = products.filter((p) => p.category === cat);
        for (let i = 0; i < catProds.length; i++) {
            const p = catProds[i];
            const coords = computeProductCoordinates(cat, i);
            await db.collection("products").updateOne(
                { _id: p._id },
                { $set: { coordinates3D: coords } }
            );
            count++;
        }
    }
    console.log(`✓ Successfully updated ${count} products.`);

    console.log("2. Purging old floorswaps collection...");
    const delRes = await db.collection("floorswaps").deleteMany({});
    console.log(`✓ Deleted ${delRes.deletedCount} floor swaps.`);

    console.log("3. Resetting Planogram state...");
    await db.collection("planograms").updateMany({}, { $set: { applied: false, activePairId: "" } });
    console.log("✓ Planograms reset.");

    console.log("4. Deleting stale recommendation snapshots...");
    const snapDel = await db.collection("recommendationsnapshots").deleteMany({});
    console.log(`✓ Deleted ${snapDel.deletedCount} recommendation snapshots.`);

    await mongoose_1.default.disconnect();
    console.log("Database cleanup completed successfully.");
    process.exit(0);
};

cleanStoreState().catch((err) => {
    console.error("Clean store state failed:", err);
    process.exit(1);
});
