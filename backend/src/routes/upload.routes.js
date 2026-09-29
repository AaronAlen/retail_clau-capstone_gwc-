"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const cloudinary_1 = __importStar(require("../config/cloudinary"));
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only image files (JPEG, PNG, WEBP) are allowed"));
        }
    },
});
router.use(auth_1.protect);
router.post("/", (0, role_1.authorize)("admin", "manager"), upload.single("image"), (0, express_async_handler_1.default)(async (req, res) => {
    if (req.file) {
        const result = await (0, cloudinary_1.uploadBufferToCloudinary)(req.file.buffer, "velocity_retail/products");
        res.status(201).json({
            url: result.secure_url,
            public_id: result.public_id,
            format: req.file.mimetype,
        });
        return;
    }
    if (req.body.imageUrl) {
        const result = await cloudinary_1.default.uploader.upload(req.body.imageUrl, {
            folder: "velocity_retail/products",
        });
        res.status(201).json({
            url: result.secure_url,
            public_id: result.public_id,
        });
        return;
    }
    res.status(400);
    throw new Error("No image file or imageUrl provided for upload");
}));
exports.default = router;
//# sourceMappingURL=upload.routes.js.map