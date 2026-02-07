import express from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.get('/', userAuth, getWishlist);
router.post('/add', userAuth, addToWishlist);
router.delete('/remove/:productId', userAuth, removeFromWishlist);

export default router;
