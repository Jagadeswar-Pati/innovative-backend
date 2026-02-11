import mongoose from 'mongoose';
import Product from '../models/Product.model.js';
import { uploadToCloudinary } from '../middleware/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { createNotification } from '../utils/notificationHelpers.js';

// GET PRODUCT BY ID
export const getProductById = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(rawId);
    const product = isObjectId
      ? await Product.findById(rawId)
      : await Product.findOne({ sku: rawId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL PRODUCTS
export const getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// CREATE PRODUCT (UPLOAD IMAGES or accept URL strings)
export const createProduct = async (req, res, next) => {
  try {
    let uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'innovative-hub/products');
        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    } else if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
      // Admin pastes image URLs (e.g. from Cloudinary)
      uploadedImages = req.body.images
        .filter((img) => typeof img === 'string' && img.trim())
        .map((url) => ({ url: url.trim(), publicId: '' }));
    }

    const { images: _bodyImages, ...restBody } = req.body;
    const product = await Product.create({
      ...restBody,
      images: uploadedImages
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res, next) => {
  try {
    const normalizeImages = (images) => {
      if (!images) return undefined;
      const list = Array.isArray(images) ? images : [images];
      return list
        .map((img) => {
          if (!img) return null;
          if (typeof img === 'string') {
            const url = img.trim();
            return url ? { url, publicId: '' } : null;
          }
          if (typeof img === 'object') {
            const url = (img.url || img.secure_url || '').toString().trim();
            if (!url) return null;
            const publicId = (img.publicId || img.public_id || '').toString();
            return { url, publicId };
          }
          return null;
        })
        .filter(Boolean);
    };

    const updates = { ...req.body };
    if (req.body.images) {
      updates.images = normalizeImages(req.body.images);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// TOGGLE PRODUCT STATUS (active/inactive)
export const toggleProductStatus = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PRODUCT STOCK STATUS (in_stock/out_of_stock) - used by admin
export const updateProductStock = async (req, res, next) => {
  try {
    const { stockStatus } = req.body;
    if (!['in_stock', 'out_of_stock'].includes(stockStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid stockStatus' });
    }
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
    const updates = { stockStatus };
    if (stockStatus === 'out_of_stock') updates.stockQuantity = 0;
    else if (existing.stockQuantity === 0) updates.stockQuantity = 1;
    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (product && stockStatus === 'out_of_stock') {
      void createNotification({
        type: 'system',
        title: 'Out of Stock',
        message: `${product.name} was marked out of stock.`,
        entityType: 'Product',
        entityId: product._id,
      });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// DELETE PRODUCT + DELETE CLOUDINARY IMAGES
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete images from Cloudinary (skip if no publicId - pasted URLs)
    for (const img of product.images) {
      if (img.publicId) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (e) {
          console.warn('Cloudinary delete failed for', img.publicId, e.message);
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product and images deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
