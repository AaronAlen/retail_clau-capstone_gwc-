import { Router, Response } from "express";
import multer from "multer";
import asyncHandler from "express-async-handler";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/role";
import { AuthRequest } from "../types";
import cloudinary, { uploadBufferToCloudinary } from "../config/cloudinary";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WEBP) are allowed"));
    }
  },
});

router.use(protect);

router.post(
  "/",
  authorize("admin", "manager"),
  upload.single("image"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.file) {
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        "velocity_retail/products"
      );
      res.status(201).json({
        url: result.secure_url,
        public_id: result.public_id,
        format: req.file.mimetype,
      });
      return;
    }

    if (req.body.imageUrl) {
      const result = await cloudinary.uploader.upload(req.body.imageUrl, {
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
  })
);

export default router;
