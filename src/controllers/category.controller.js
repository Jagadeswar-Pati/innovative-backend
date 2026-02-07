import Product from '../models/Product.model.js';

export const getAllCategories = async (req, res, next) => {
  try {
    // Get all unique categories from products.categories array
    const categories = await Product.distinct('categories');

    const categoryData = categories
      .filter((cat) => typeof cat === 'string' && cat.trim())
      .map((cat) => ({
        id: cat.toLowerCase().replace(/\s+/g, '-'),
        name: cat,
        slug: cat.toLowerCase().replace(/\s+/g, '-')
      }));

    res.json({
      success: true,
      data: categoryData
    });
  } catch (err) {
    next(err);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const categoryName = slug.replace(/-/g, ' ').toLowerCase();

    const products = await Product.find({
      categories: new RegExp(categoryName, 'i')
    });

    res.json({
      success: true,
      data: {
        slug,
        name: categoryName,
        productCount: products.length,
        products
      }
    });
  } catch (err) {
    next(err);
  }
};
