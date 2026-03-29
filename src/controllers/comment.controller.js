import Comment from '../models/Comment.model.js';
import Order from '../models/Order.model.js';
import { createNotification } from '../utils/notificationHelpers.js';

export const createComment = async (req, res, next) => {
  try {
    const { productId, orderId, comment } = req.body;
    if (!productId || !orderId || !comment) {
      return res.status(400).json({ success: false, message: 'productId, orderId, and comment are required' });
    }

    const order = await Order.findOne({
      _id: orderId,
      customerId: req.user._id,
      orderStatus: 'delivered',
      'items.productId': productId,
    });
    if (!order) {
      return res.status(400).json({ success: false, message: 'Delivered order not found for this product' });
    }

    const doc = await Comment.create({
      productId,
      userId: req.user._id,
      orderId,
      comment,
    });

    void createNotification({
      type: 'review',
      title: 'New Comment Submitted',
      message: `A new comment was submitted for order ${orderId}.`,
      entityType: 'Comment',
      entityId: doc._id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

export const getAllComments = async (_req, res, next) => {
  try {
    const comments = await Comment.find()
      .populate('productId', 'name')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
};

export const updateCommentStatus = async (req, res, next) => {
  try {
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    res.status(200).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};
