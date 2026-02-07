import dotenv from 'dotenv';
import mongoose from 'mongoose';
import https from 'https';

dotenv.config();

console.log('\n🔍 VERIFYING ALL API KEYS AND CONFIGURATIONS\n');
console.log('='.repeat(60));

// 1. Check environment variables are loaded
console.log('\n✅ ENVIRONMENT VARIABLES:');
console.log('-'.repeat(60));

const requiredVars = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDINARY_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

const optionalVars = [
  'CORS_ORIGIN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const masked = value.length > 20 ? value.substring(0, 10) + '...' + value.substring(value.length - 5) : value;
    console.log(`✓ ${varName.padEnd(25)} ${masked}`);
  } else {
    console.log(`✗ ${varName.padEnd(25)} ❌ MISSING`);
  }
});

console.log('\n📋 OPTIONAL VARIABLES:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const masked = value.length > 30 ? value.substring(0, 15) + '...' : value;
    console.log(`✓ ${varName.padEnd(25)} ${masked}`);
  } else {
    console.log(`- ${varName.padEnd(25)} (not set)`);
  }
});

// 2. Test MongoDB Connection
console.log('\n\n🗄️  TESTING MONGODB CONNECTION:');
console.log('-'.repeat(60));
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✓ MongoDB connection successful');
  await mongoose.disconnect();
} catch (error) {
  console.log('✗ MongoDB connection failed:', error.message);
}

// 3. Test Cloudinary Configuration
console.log('\n\n🖼️  TESTING CLOUDINARY:');
console.log('-'.repeat(60));
try {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    // Parse cloudinary URL
    const urlObj = new URL(cloudinaryUrl);
    const account_id = urlObj.username;
    const api_key = urlObj.password.split(':')[0];
    const api_secret = urlObj.password.split(':')[1];
    console.log('✓ Cloudinary URL parsed successfully');
    console.log(`  - Cloud Name: ${urlObj.hostname}`);
    console.log(`  - Account ID: ${account_id}`);
    console.log(`  - API Key: ${api_key.substring(0, 10)}...`);
  }
} catch (error) {
  console.log('✗ Cloudinary parsing failed:', error.message);
}

// 4. Test Razorpay Keys Format
console.log('\n\n💳 TESTING RAZORPAY KEYS:');
console.log('-'.repeat(60));
try {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    console.log('✗ Razorpay keys missing');
  } else {
    console.log('✓ Razorpay keys configured');
    console.log(`  - Key ID: ${keyId.substring(0, 20)}...`);
    console.log(`  - Key Secret: ${keySecret.substring(0, 10)}...`);
    
    // Verify format
    if (keyId.startsWith('rzp_')) {
      console.log('✓ Razorpay Key ID format is valid');
    } else {
      console.log('⚠  Razorpay Key ID format may be invalid');
    }
    
    // Test Razorpay API with HTTPS
    const options = {
      hostname: 'api.razorpay.com',
      path: '/v1/payments?count=1',
      method: 'GET',
      auth: `${keyId}:${keySecret}`
    };
    
    https.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✓ Razorpay API keys are valid and working');
      } else if (res.statusCode === 401) {
        console.log('✗ Razorpay API keys are invalid (401 - Unauthorized)');
      } else {
        console.log(`⚠  Razorpay API response: ${res.statusCode}`);
      }
    }).on('error', (error) => {
      if (error.code === 'ENOTFOUND') {
        console.log('⚠  Cannot verify Razorpay (network/DNS issue) - Keys format looks OK');
      } else {
        console.log('⚠  Razorpay verification inconclusive:', error.message);
      }
    }).end();
  }
} catch (error) {
  console.log('✗ Razorpay verification failed:', error.message);
}

// 5. Test JWT Secret
console.log('\n\n🔐 JWT CONFIGURATION:');
console.log('-'.repeat(60));
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret) {
  console.log('✓ JWT Secret configured');
  console.log(`  - Length: ${jwtSecret.length} characters`);
  console.log(`  - Value: ${jwtSecret}`);
} else {
  console.log('✗ JWT Secret not configured');
}

// 6. Test Google OAuth (if configured)
console.log('\n\n🌐 GOOGLE OAUTH:');
console.log('-'.repeat(60));
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  console.log('✓ Google OAuth credentials configured');
  console.log(`  - Client ID: ${googleClientId.substring(0, 15)}...`);
} else {
  console.log('- Google OAuth not configured (optional)');
}

// 7. Server Configuration
console.log('\n\n🚀 SERVER CONFIGURATION:');
console.log('-'.repeat(60));
console.log(`✓ Port: ${process.env.PORT}`);
console.log(`✓ Environment: ${process.env.NODE_ENV}`);
console.log(`✓ CORS Origin: ${process.env.CORS_ORIGIN}`);

console.log('\n' + '='.repeat(60));
console.log('✅ VERIFICATION COMPLETE\n');
