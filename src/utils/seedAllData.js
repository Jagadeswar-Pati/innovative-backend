import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import Cart from '../models/Cart.model.js';
import Order from '../models/Order.model.js';
import Review from '../models/Review.model.js';
import Payment from '../models/Payment.model.js';
import Notification from '../models/Notification.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const productsInput = [
  {
    name: 'Flex Sensor 2.2 inch Bend Sensor',
    sku: 'IHB-SEN-001',
    categories: ['Sensors', 'Robotics'],
    shortDescription: 'High quality flex sensor for gesture and bend detection projects.',
    longDescription:
      '<p>This 2.2 inch flex sensor changes resistance when bent and is widely used in robotics, wearables, and hand gesture recognition systems.</p><ul><li>Operating Voltage: 3.3V–5V</li><li>Length: 2.2 inch</li><li>Life Cycle: >1 million bends</li></ul>',
    mrp: 350,
    sellingPrice: 300,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 50,
    status: 'active',
    images: [
      'https://res.cloudinary.com/demo/image/upload/v1690000001/innovativehub/flex_sensor_1.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1690000002/innovativehub/flex_sensor_2.jpg',
    ],
  },
  {
    name: 'Arduino Uno R3 Compatible Board',
    sku: 'IHB-MCU-001',
    categories: ['Microcontrollers', 'Development Boards'],
    shortDescription: 'ATmega328P based Arduino Uno R3 compatible board.',
    longDescription:
      '<p>The Arduino Uno R3 is a microcontroller board based on the ATmega328P.</p><p>Ideal for beginners and professionals working on embedded and IoT projects.</p>',
    mrp: 550,
    sellingPrice: 480,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 40,
    status: 'active',
    images: [
      'https://res.cloudinary.com/demo/image/upload/v1690000011/innovativehub/arduino_uno_1.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1690000012/innovativehub/arduino_uno_2.jpg',
    ],
  },
  {
    name: 'ESP32 WiFi + Bluetooth Development Board',
    sku: 'IHB-MCU-002',
    categories: ['Microcontrollers', 'IoT'],
    shortDescription: 'Dual-core ESP32 board with WiFi and Bluetooth.',
    longDescription:
      '<p>ESP32 is a powerful MCU with integrated WiFi and Bluetooth, suitable for IoT and automation projects.</p>',
    mrp: 750,
    sellingPrice: 680,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 30,
    status: 'active',
    images: [
      'https://res.cloudinary.com/demo/image/upload/v1690000021/innovativehub/esp32_1.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1690000022/innovativehub/esp32_2.jpg',
    ],
  },
];

const usersInput = [
  {
    name: 'Rohit Kumar',
    email: 'rohit.kumar@gmail.com',
    password: 'Rohit@123',
    phone: '9876543210',
    addresses: [
      {
        fullName: 'Rohit Kumar',
        mobile: '9876543210',
        addressLine1: 'Plot No 21, Saheed Nagar',
        addressLine2: 'Near ICICI Bank',
        city: 'Bhubaneswar',
        state: 'Odisha',
        pincode: '751007',
        isDefault: true,
      },
    ],
  },
];

const ordersInput = [
  {
    userEmail: 'rohit.kumar@gmail.com',
    products: [
      { sku: 'IHB-SEN-001', qty: 2, price: 300 },
      { sku: 'IHB-MCU-001', qty: 1, price: 480 },
    ],
    pricing: {
      subtotal: 1080,
      deliveryCharge: 50,
      taxAmount: 0,
      totalAmount: 1130,
    },
    paymentMethod: 'COD',
    paymentStatus: 'unpaid',
    orderStatus: 'processing',
    delivery: {
      partnerName: 'Shiprocket',
      trackingId: 'SRK123456789',
      trackingLink: 'https://shiprocket.co/tracking/SRK123456789',
    },
    addressSnapshot: {
      fullName: 'Rohit Kumar',
      mobile: '9876543210',
      addressLine1: 'Plot No 21, Saheed Nagar',
      addressLine2: 'Near ICICI Bank',
      city: 'Bhubaneswar',
      state: 'Odisha',
      pincode: '751007',
      country: 'India',
    },
    invoice: {
      invoiceNumber: 'INV-IHB-1001',
      invoiceUrl: 'https://res.cloudinary.com/demo/raw/upload/v1690000101/innovativehub/invoice_1001.pdf',
      sentOnEmail: true,
      sentOnWhatsapp: false,
    },
  },
];

const cartsInput = [
  {
    userEmail: 'rohit.kumar@gmail.com',
    products: [{ sku: 'IHB-MCU-002', quantity: 1, priceSnapshot: 680 }],
  },
];

const reviewsInput = [
  {
    userEmail: 'rohit.kumar@gmail.com',
    productSku: 'IHB-SEN-001',
    rating: 5,
    comment: 'Very good quality flex sensor. Works perfectly with Arduino.',
    status: 'approved',
  },
];

const paymentsInput = [
  {
    orderRef: 'INV-IHB-1001',
    amount: 1130,
    status: 'pending',
    method: 'COD',
    transactionId: '',
  },
];

const notificationsInput = [
  {
    type: 'order',
    title: 'Order Processing',
    message: 'Your order INV-IHB-1001 is currently being processed.',
    read: false,
  },
];

const buildImages = (urls) => urls.map((url) => ({ url, publicId: '' }));

const run = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);

  for (const product of productsInput) {
    const payload = {
      ...product,
      images: buildImages(product.images),
    };
    await Product.updateOne({ sku: product.sku }, payload, { upsert: true });
  }

  for (const user of usersInput) {
    let existing = await User.findOne({ email: user.email.toLowerCase() });
    if (!existing) {
      existing = await User.create({
        name: user.name,
        email: user.email.toLowerCase(),
        password: user.password,
        phone: user.phone,
        mobile: user.phone,
        addresses: user.addresses,
      });
    } else {
      existing.name = user.name;
      existing.phone = user.phone;
      existing.mobile = user.phone;
      existing.addresses = user.addresses;
      await existing.save();
    }
  }

  for (const order of ordersInput) {
    const user = await User.findOne({ email: order.userEmail.toLowerCase() });
    if (!user) continue;

    const existingOrder = await Order.findOne({
      customerId: user._id,
      'invoice.invoiceNumber': order.invoice.invoiceNumber,
    });
    if (existingOrder) continue;

    const productDocs = await Product.find({ sku: { $in: order.products.map((p) => p.sku) } });
    const productMap = new Map(productDocs.map((p) => [p.sku, p]));

    const items = order.products.map((p) => {
      const doc = productMap.get(p.sku);
      return {
        productId: doc?._id,
        quantity: p.qty,
        price: p.price,
        name: doc?.name || '',
        image: doc?.images?.[0]?.url || '',
      };
    });

    await Order.create({
      customerId: user._id,
      customerName: user.name,
      items,
      itemsCount: items.length,
      totalAmount: order.pricing.totalAmount,
      pricing: order.pricing,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      trackingLink: order.delivery?.trackingLink || '',
      delivery: order.delivery || {},
      addressSnapshot: order.addressSnapshot,
      invoice: order.invoice,
    });
  }

  for (const cart of cartsInput) {
    const user = await User.findOne({ email: cart.userEmail.toLowerCase() });
    if (!user) continue;
    const productDocs = await Product.find({ sku: { $in: cart.products.map((p) => p.sku) } });
    const productMap = new Map(productDocs.map((p) => [p.sku, p]));
    const products = cart.products
      .map((p) => {
        const doc = productMap.get(p.sku);
        if (!doc) return null;
        return {
          product: doc._id,
          quantity: p.quantity,
          priceSnapshot: p.priceSnapshot,
        };
      })
      .filter(Boolean);
    await Cart.updateOne(
      { user: user._id },
      { user: user._id, products, status: 'active' },
      { upsert: true }
    );
  }

  for (const review of reviewsInput) {
    const user = await User.findOne({ email: review.userEmail.toLowerCase() });
    const product = await Product.findOne({ sku: review.productSku });
    if (!user || !product) continue;
    await Review.updateOne(
      { userId: user._id, productId: product._id },
      {
        userId: user._id,
        userName: user.name,
        productId: product._id,
        productName: product.name,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
      },
      { upsert: true }
    );
  }

  for (const payment of paymentsInput) {
    const order = await Order.findOne({ 'invoice.invoiceNumber': payment.orderRef });
    if (!order) continue;
    const existing = await Payment.findOne({ orderId: order._id });
    if (existing) continue;
    await Payment.create({
      orderId: order._id,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      transactionId: payment.transactionId,
    });
  }

  for (const notification of notificationsInput) {
    await Notification.create(notification);
  }

  const summary = {
    products: await Product.countDocuments(),
    users: await User.countDocuments(),
    orders: await Order.countDocuments(),
    carts: await Cart.countDocuments(),
    reviews: await Review.countDocuments(),
    payments: await Payment.countDocuments(),
    notifications: await Notification.countDocuments(),
  };

  console.log('Seed complete:', summary);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
