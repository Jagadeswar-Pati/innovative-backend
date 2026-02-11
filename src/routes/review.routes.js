import express from 'express';
import { getAllReviews, updateReviewStatus, deleteReview, createReview, getPublicReviews, getReviewMode, updateReviewMode } from '../controllers/review.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.post('/', userAuth, createReview);
router.get('/public', getPublicReviews);
router.get('/mode', getReviewMode);

router.use(adminAuth);

router.get('/', getAllReviews);
router.patch('/:id/status', updateReviewStatus);
router.delete('/:id', deleteReview);
router.put('/mode', updateReviewMode);

export default router;