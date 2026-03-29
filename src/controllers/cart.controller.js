import Cart from '../models/Cart.model.js';
import Product from '../models/Product.model.js';

const getStock = (product) => Number(product?.stockQuantity ?? 0);

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
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const stock = getStock(product);
    if (stock <= 0) {
      return res.status(400).json({ message: 'Product is out of stock' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, products: [] });
    const itemIndex = cart.products.findIndex((i) => i.product.equals(productId));
    if (itemIndex > -1) {
      const next = cart.products[itemIndex].quantity + qty;
      cart.products[itemIndex].quantity = Math.min(next, stock);
      cart.products[itemIndex].priceSnapshot = product.sellingPrice;
    } else {
      const initial = Math.min(qty, stock);
      cart.products.push({
        product: productId,
        priceSnapshot: product.sellingPrice,
        quantity: initial,
      });
    }
    await cart.save();
    const populated = await cart.populate('products.product');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error adding to cart' });
  }
};

// Set line quantity (replaces remove+add for smooth UI)
export const updateCartItemQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }
    const q = Math.floor(Number(quantity));
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const stock = getStock(product);

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    const itemIndex = cart.products.findIndex((i) => i.product.equals(productId));
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not in cart' });
    }

    if (q < 1) {
      cart.products = cart.products.filter((i) => !i.product.equals(productId));
    } else {
      if (stock <= 0) {
        return res.status(400).json({ message: 'Product is out of stock' });
      }
      const clamped = Math.min(q, stock);
      cart.products[itemIndex].quantity = clamped;
      cart.products[itemIndex].priceSnapshot = product.sellingPrice;
    }
    await cart.save();
    const populated = await cart.populate('products.product');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating cart' });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    cart.products = cart.products.filter((i) => !i.product.equals(productId));
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
    const populated = await cart.populate('products.product');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error clearing cart' });
  }
};
