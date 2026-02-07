import Cart from '../models/Cart.model.js';
import Product from '../models/Product.model.js';

// Get user's cart
export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('products.product');
    res.json(cart || { products: [] });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cart' });
  }
};

// Add item to cart
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number(quantity) || 1;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, products: [] });
    const itemIndex = cart.products.findIndex(i => i.product.equals(productId));
    if (itemIndex > -1) {
      cart.products[itemIndex].quantity += qty;
    } else {
      cart.products.push({
        product: productId,
        priceSnapshot: product.sellingPrice,
        quantity: qty,
      });
    }
    await cart.save();
    const populated = await cart.populate('products.product');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error adding to cart' });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    cart.products = cart.products.filter(i => !i.product.equals(productId));
    await cart.save();
    const populated = await cart.populate('products.product');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error removing from cart' });
  }
};

// Clear cart
export const clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    cart.products = [];
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Error clearing cart' });
  }
};
