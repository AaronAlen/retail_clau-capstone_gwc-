"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBufferToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
const uploadBufferToCloudinary = (buffer, folder = "velocity_retail/products", publicId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            public_id: publicId,
            resource_type: "image",
            overwrite: true,
        }, (error, result) => {
            if (error || !result) {
                return reject(error || new Error("Cloudinary upload failed"));
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
            });
        });
        uploadStream.end(buffer);
    });
};
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
exports.default = cloudinary_1.v2;
//# sourceMappingURL=cloudinary.js.map