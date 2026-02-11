import Review from '../models/Review.model.js';
import Order from '../models/Order.model.js';
import Rating from '../models/Rating.model.js';
import { createNotification } from '../utils/notificationHelpers.js';
import ReviewSettings from '../models/ReviewSettings.model.js';

const getReviewSettings = async () => {
  const existing = await ReviewSettings.findOne();
  if (existing) return existing;
  return ReviewSettings.create({ mode: 'delivered-only' });
};

export const createReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    if (!productId || rating == null) {
      return res.status(400).json({ success: false, message: 'productId and rating are required' });
    }

    const settings = await getReviewSettings();
    let order = null;
    if (settings.mode === 'delivered-only') {
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'orderId is required for delivered-only reviews' });
      }
      order = await Order.findOne({
        _id: orderId,
        customerId: req.user._id,
        orderStatus: 'delivered',
        'items.productId': productId,
      });
      if (!order) {
        return res.status(400).json({ success: false, message: 'Delivered order not found for this product' });
      }
    }

    const review = await Review.create({
      productId,
      userId: req.user._id,
      orderId: orderId || undefined,
      rating,
      comment: comment || '',
      userName: req.user.name,
    });

    await Rating.create({
      productId,
      userId: req.user._id,
      orderId: orderId || undefined,
      rating,
    });

    void createNotification({
      type: 'review',
      title: 'New Review Submitted',
      message: orderId ? `A new review was submitted for order ${orderId}.` : 'A new review was submitted.',
      entityType: 'Review',
      entityId: review._id,
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const getReviewMode = async (_req, res, next) => {
  try {
    const settings = await getReviewSettings();
    res.status(200).json({ success: true, data: { mode: settings.mode } });
  } catch (error) {
    next(error);
  }
};

export const updateReviewMode = async (req, res, next) => {
  try {
    const { mode } = req.body;
    if (!['any-user', 'delivered-only'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid review mode' });
    }
    const settings = await getReviewSettings();
    settings.mode = mode;
    await settings.save();
    res.status(200).json({ success: true, data: { mode: settings.mode } });
  } catch (error) {
    next(error);
  }
};

// GET APPROVED REVIEWS (PUBLIC)
export const getPublicReviews = async (req, res, next) => {
  try {
    const { productId } = req.query;
    const filter = { status: 'approved' };
    if (productId) filter.productId = productId;

    const reviews = await Review.find(filter)
      .populate('productId', 'name')
      .populate('userId', 'name email profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL REVIEWS
export const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('productId', 'name')
      .populate('userId', 'name email profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE REVIEW STATUS
export const updateReviewStatus = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// DELETE REVIEW
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};