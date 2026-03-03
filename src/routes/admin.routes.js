import express from "express";
import { adminLogin } from "../controllers/admin.controller.js";
import adminAuth from "../middleware/adminAuth.middleware.js";
import upload, { uploadVideo, uploadToCloudinary } from "../middleware/upload.middleware.js";
import { createProduct, updateProduct } from "../controllers/product.controller.js";
import { cleanupOldInvoiceUploads } from "../utils/cleanupInvoiceCloudinary.js";

const router = express.Router();

router.post("/login", adminLogin);

router.get("/profile", adminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

const maybeUploadImages = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return next();
  return upload.array('images', 5)(req, res, next);
};

// Product management (admin scope)
router.post("/products", adminAuth, maybeUploadImages, createProduct);
router.put("/products/:id", adminAuth, updateProduct);

// Image upload endpoints
router.post("/upload/image", adminAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    const result = await uploadToCloudinary(req.file.buffer, "innovative-hub/products");
    res.status(200).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error) {
    next(error);
  }
});

router.post("/upload/editor-image", adminAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    const result = await uploadToCloudinary(req.file.buffer, "innovative-hub/editor");
    res.status(200).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error) {
    next(error);
  }
});

// Video upload for product videos (mp4, webm, mov, etc.). Clear errors so admin can retry.
router.post("/upload/video", adminAuth, (req, res, next) => {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Video is too large (max 100MB). Please choose a smaller file and try again.",
        });
      }
      if (err.message && err.message.includes("video")) {
        return res.status(400).json({
          success: false,
          message: "Only video files are allowed (e.g. mp4, webm, mov). Please select a video and try again.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Video upload failed. Please try again.",
      });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file provided. Please select a file and try again." });
    }
    const result = await uploadToCloudinary(req.file.buffer, "innovative-hub/products", "video");
    res.status(200).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Video upload failed. Please try again.",
    });
  }
});

// Delete invoice PDFs from Cloudinary older than 1 hour (run hourly or manually)
router.post("/cleanup-invoices", adminAuth, async (req, res, next) => {
  try {
    const result = await cleanupOldInvoiceUploads();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
