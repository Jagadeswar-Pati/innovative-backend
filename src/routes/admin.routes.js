import express from "express";
import { adminLogin } from "../controllers/admin.controller.js";
import adminAuth from "../middleware/adminAuth.middleware.js";
import upload, { uploadToCloudinary } from "../middleware/upload.middleware.js";
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
