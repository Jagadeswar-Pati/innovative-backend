import express from 'express';
import upload, { uploadToCloudinary } from '../middleware/upload.middleware.js';
import adminAuth from '../middleware/adminAuth.middleware.js';

import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  updateProductStock,
  deleteProduct
} from '../controllers/product.controller.js';

const router = express.Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);

router.post(
  '/',
  adminAuth,
  upload.array('images', 5),
  createProduct
);

router.put('/:id', adminAuth, updateProduct);

router.patch('/:id/status', adminAuth, toggleProductStatus);
router.patch('/:id/stock', adminAuth, updateProductStock);

router.delete('/:id', adminAuth, deleteProduct);

// Image upload endpoint
router.post('/upload-image', adminAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'innovative-hub/products');

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
