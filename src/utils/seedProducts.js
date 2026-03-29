import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const imageSetA = [
  'https://res.cloudinary.com/demo/image/upload/v1690000001/innovativehub/flex_sensor_1.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000002/innovativehub/flex_sensor_2.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000003/innovativehub/flex_sensor_3.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000004/innovativehub/flex_sensor_4.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000005/innovativehub/flex_sensor_5.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000006/innovativehub/flex_sensor_6.jpg',
];

const imageSetB = [
  'https://res.cloudinary.com/demo/image/upload/v1690000011/innovativehub/arduino_uno_1.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000012/innovativehub/arduino_uno_2.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000013/innovativehub/arduino_uno_3.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000014/innovativehub/arduino_uno_4.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000015/innovativehub/arduino_uno_5.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1690000016/innovativehub/arduino_uno_6.jpg',
];

const buildImages = (urls) => urls.map((url) => ({ url, publicId: '' }));

const products = [
  {
    name: 'Flex Sensor 2.2" Bend Sensor',
    sku: 'IHB-SEN-001',
    categories: ['Sensors'],
    shortDescription: 'Bend sensing resistor ideal for motion and flex detection.',
    longDescription: 'A 2.2" flex sensor that changes resistance when bent. Suitable for wearables, robotics, and gesture input prototypes.',
    mrp: 350,
    sellingPrice: 300,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 50,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetA),
  },
  {
    name: 'Ultrasonic Sensor HC-SR04',
    sku: 'IHB-SEN-002',
    categories: ['Sensors'],
    shortDescription: 'Distance measuring ultrasonic sensor module.',
    longDescription: 'HC-SR04 sensor for accurate distance measurement using ultrasonic pulses. Works well for obstacle detection.',
    mrp: 180,
    sellingPrice: 150,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 100,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetA.slice(0, 3)),
  },
  {
    name: 'IR Obstacle Avoidance Sensor',
    sku: 'IHB-SEN-003',
    categories: ['Sensors'],
    shortDescription: 'IR sensor module for obstacle detection.',
    longDescription: 'Infrared obstacle sensor with adjustable range and digital output. Great for line-following and basic detection.',
    mrp: 120,
    sellingPrice: 95,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 80,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetA.slice(3, 6)),
  },
  {
    name: 'Arduino Uno R3 Compatible Board',
    sku: 'IHB-MCU-001',
    categories: ['Microcontrollers'],
    shortDescription: 'ATmega328P development board, Arduino Uno compatible.',
    longDescription: 'Arduino Uno R3 compatible board for rapid prototyping with a wide ecosystem of shields and libraries.',
    mrp: 550,
    sellingPrice: 480,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 40,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetB),
  },
  {
    name: 'ESP32 WiFi + Bluetooth Development Board',
    sku: 'IHB-MCU-002',
    categories: ['Microcontrollers'],
    shortDescription: 'Dual-core ESP32 board with WiFi and BLE.',
    longDescription: 'ESP32 development board with WiFi and Bluetooth for IoT applications, offering strong community support.',
    mrp: 750,
    sellingPrice: 680,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 30,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetB.slice(0, 3)),
  },
  {
    name: '5V 2-Channel Relay Module',
    sku: 'IHB-REL-001',
    categories: ['Modules'],
    shortDescription: 'Two-channel relay board for AC/DC load control.',
    longDescription: '5V relay module with two channels, suitable for controlling high-voltage loads from microcontrollers.',
    mrp: 220,
    sellingPrice: 190,
    gstMode: 'including',
    gstPercentage: 18,
    stockQuantity: 60,
    stockStatus: 'in_stock',
    status: 'active',
    images: buildImages(imageSetB.slice(3, 6)),
  },
];

const run = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);

  for (const product of products) {
    await Product.updateOne({ sku: product.sku }, product, { upsert: true });
  }

  const count = await Product.countDocuments();
  console.log(`Seed complete. Product count: ${count}`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
