import mongoose from 'mongoose';
import Product from '../models/Product.model.js';
import { uploadToCloudinary } from '../middleware/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { createNotification } from '../utils/notificationHelpers.js';
import productListCache from '../utils/productListCache.js';

/** Lean projection for list endpoint: id, name, price, thumbnail, rating + fields needed for frontend cards */
const LIST_PROJECTION =
  '_id name sellingPrice mrp gstMode gstPercentage categories images videos stockQuantity sku shortDescription createdAt updatedAt';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CACHE_TTL_SEC = 60;

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

/**
 * GET ALL PRODUCTS — optimized for high performance.
 * Query params: page, limit (default 20). Also supports skip for backward compatibility.
 * Response: { products, totalProducts, currentPage, totalPages } plus data/total for frontend.
 * Uses LIMIT/OFFSET, lean projection, indexing, and optional caching.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const limitParam = parseInt(req.query.limit, 10);
    const pageParam = parseInt(req.query.page, 10);
    const skipParam = parseInt(req.query.skip, 10);

    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    let page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
    if (Number.isFinite(skipParam) && skipParam >= 0 && !Number.isFinite(pageParam)) {
      page = Math.floor(skipParam / limit) + 1;
    }
    const skip = (page - 1) * limit;

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sortParam = (req.query.sort || 'newest').toString().toLowerCase();

    const cacheKey = productListCache.buildKey({ page, limit, category, search, sort: sortParam });
    const cached = productListCache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const query = { status: 'active' };

    if (category) {
      const safeCat = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const catRegex = new RegExp(safeCat.replace(/-/g, '[-\\s&/]*'), 'i');
      query.categories = catRegex;
    }

    if (search) {
      const words = search
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2);
      if (words.length > 0) {
        query.$and = words.map((word) => {
          const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(safe, 'i');
          return {
            $or: [
              { name: regex },
              { shortDescription: regex },
              { sku: regex },
              { categories: regex }
            ]
          };
        });
      }
    }

    let sort = { createdAt: -1 };
    if (sortParam === 'price-low') sort = { sellingPrice: 1 };
    else if (sortParam === 'price-high') sort = { sellingPrice: -1 };
    else if (sortParam === 'name') sort = { name: 1 };

    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .select(LIST_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));

    const items = products.map((p) => ({
      ...p,
      rating: 0,
      thumbnail: Array.isArray(p.images) && p.images[0] && p.images[0].url
        ? p.images[0].url
        : ''
    }));

    const payload = {
      success: true,
      products: items,
      totalProducts,
      currentPage: page,
      totalPages,
      data: items,
      total: totalProducts
    };

    productListCache.set(cacheKey, payload, CACHE_TTL_SEC);

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

// Normalize media array (images or videos): URLs or { url, publicId }
const normalizeMedia = (list) => {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url, publicId: '' } : null;
      }
      if (typeof item === 'object') {
        const url = (item.url || item.secure_url || '').toString().trim();
        if (!url) return null;
        const publicId = (item.publicId || item.public_id || '').toString();
        return { url, publicId };
      }
      return null;
    })
    .filter(Boolean);
};

// CREATE PRODUCT (UPLOAD IMAGES or accept URL strings; VIDEOS as URLs from /upload/video)
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

    const videos = normalizeMedia(req.body.videos);

    const { images: _bodyImages, videos: _bodyVideos, ...restBody } = req.body;
    const product = await Product.create({
      ...restBody,
      images: uploadedImages,
      videos
    });

    productListCache.invalidateAll();

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
      return normalizeMedia(images);
    };

    const updates = { ...req.body };
    if (req.body.images) {
      updates.images = normalizeImages(req.body.images);
    }
    if (req.body.videos !== undefined) {
      updates.videos = normalizeMedia(req.body.videos);
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

    productListCache.invalidateAll();

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

    productListCache.invalidateAll();

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
    productListCache.invalidateAll();

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
    for (const img of product.images || []) {
      if (img.publicId) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (e) {
          console.warn('Cloudinary delete failed for', img.publicId, e.message);
        }
      }
    }
    // Delete videos from Cloudinary
    for (const vid of product.videos || []) {
      if (vid.publicId) {
        try {
          await cloudinary.uploader.destroy(vid.publicId, { resource_type: 'video' });
        } catch (e) {
          console.warn('Cloudinary delete failed for video', vid.publicId, e.message);
        }
      }
    }

    await product.deleteOne();

    productListCache.invalidateAll();

    res.status(200).json({
      success: true,
      message: 'Product, images and videos deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
