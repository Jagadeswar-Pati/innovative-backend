import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
} from '../controllers/cart.controller.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.get('/', userAuth, getCart);
router.post('/add', userAuth, addToCart);
router.put('/item', userAuth, updateCartItemQuantity);
router.post('/remove', userAuth, removeFromCart);
router.post('/clear', userAuth, clearCart);

export default router;
