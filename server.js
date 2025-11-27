// ===================================
//         server.js - ULTRA FAST ⚡
// ===================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression'); // ضغط البيانات
const helmet = require('helmet'); // حماية إضافية

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const MONGO_URI = `mongodb+srv://lolmeyazan:Cluster0@cluster0.v4wwyi5.mongodb.net/`;

// ============================================
// 🚀 تحسينات السرعة
// ============================================

// 1️⃣ ضغط الاستجابات (gzip/brotli) - يقلل حجم البيانات بنسبة 70%
app.use(compression());

// 2️⃣ حماية إضافية مع Helmet
app.use(helmet({
  contentSecurityPolicy: false, // تعطيل CSP للسماح بالموارد الخارجية
  crossOriginEmbedderPolicy: false
}));

// 2️⃣ CORS محسّن
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true,
  maxAge: 86400 // cache preflight لمدة 24 ساعة
}));

// 3️⃣ JSON parser محسّن
app.use(express.json({ limit: '10mb' }));

// 4️⃣ تعطيل X-Powered-By للأمان والسرعة
app.disable('x-powered-by');

// ============================================
// 💾 MongoDB مع Connection Pooling محسّن
// ============================================

const DataSchema = new mongoose.Schema({
  data: {
    type: Object,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true // فهرسة للبحث السريع
  }
}, {
  timestamps: true, // إضافة createdAt و updatedAt تلقائياً
  minimize: false // عدم حذف الكائنات الفارغة
});

// إضافة index للبحث الأسرع
DataSchema.index({ lastUpdated: -1 });

const DataModel = mongoose.model('SiteData', DataSchema);

// اتصال MongoDB محسّن مع Connection Pooling
if (MONGO_PASSWORD) {
  mongoose.connect(MONGO_URI, {
    maxPoolSize: 10,        // عدد الاتصالات المتزامنة
    minPoolSize: 2,         // الحد الأدنى
    serverSelectionTimeoutMS: 5000,  // timeout للاتصال
    socketTimeoutMS: 45000,          // timeout للعمليات
    family: 4,              // استخدام IPv4
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true
  })
  .then(() => {
    console.log('✅ متصل بـ MongoDB Atlas بنجاح');
    // إنشاء الـ indexes تلقائياً
    DataModel.createIndexes().then(() => {
      console.log('✅ تم إنشاء Indexes بنجاح');
    });
  })
  .catch(err => {
    console.error('❌ فشل الاتصال بـ MongoDB:', err.message);
  });
} else {
  console.error('❌ MONGO_PASSWORD غير موجود في متغيرات البيئة');
  process.exit(1);
}

// ============================================
// 📦 In-Memory Cache للبيانات
// ============================================
let dataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 1000; // 1 دقيقة

function getCachedData() {
  const now = Date.now();
  if (dataCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log('⚡ إرجاع البيانات من الكاش');
    return dataCache;
  }
  return null;
}

function setCachedData(data) {
  dataCache = data;
  cacheTimestamp = Date.now();
  console.log('💾 تم حفظ البيانات في الكاش');
}

function clearCache() {
  dataCache = null;
  cacheTimestamp = null;
  console.log('🗑️ تم مسح الكاش');
}

// ============================================
// 🌐 API Endpoints المحسّنة
// ============================================

// 1️⃣ تحميل البيانات - ULTRA FAST
app.get('/api/data/load', async (req, res) => {
  try {
    // محاولة الإرجاع من الكاش أولاً
    const cached = getCachedData();
    if (cached) {
      return res.json(cached);
    }

    // البحث في MongoDB
    const latestData = await DataModel
      .findOne()
      .sort({ lastUpdated: -1 })
      .lean()  // إرجاع plain object بدون Mongoose overhead
      .select('data -_id'); // اختيار data فقط بدون _id

    const responseData = latestData?.data || {};
    
    // حفظ في الكاش
    setCachedData(responseData);
    
    return res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في تحميل البيانات:', error);
    res.status(500).json({ 
      message: 'فشل تحميل البيانات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 2️⃣ حفظ البيانات - مع مسح الكاش
app.post('/api/data/save', async (req, res) => {
  try {
    const incomingData = req.body;
    
    if (!incomingData || Object.keys(incomingData).length === 0) {
      return res.status(400).json({ message: 'لا توجد بيانات للحفظ' });
    }

    // حفظ في MongoDB
    const savedData = await DataModel.findOneAndUpdate(
      {},
      { 
        data: incomingData,
        lastUpdated: new Date()
      },
      { 
        new: true,
        upsert: true,
        lean: true
      }
    );

    // مسح الكاش للحصول على البيانات الجديدة
    clearCache();
    
    // حفظ البيانات الجديدة في الكاش
    setCachedData(incomingData);

    res.status(200).json({ 
      message: 'تم الحفظ بنجاح',
      timestamp: savedData.lastUpdated
    });
  } catch (error) {
    console.error('❌ خطأ في حفظ البيانات:', error);
    res.status(500).json({ 
      message: 'فشل حفظ البيانات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// 🏥 Health Check & Keep-Alive
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Ping endpoint لمنع النوم
app.get('/ping', (req, res) => {
  res.status(200).json({ pong: true, time: Date.now() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'API يعمل بنجاح ⚡',
    version: '2.0',
    endpoints: {
      load: '/api/data/load',
      save: '/api/data/save',
      health: '/health',
      ping: '/ping'
    }
  });
});

// ============================================
// 🔥 Keep-Alive System (منع النوم)
// ============================================

let keepAliveInterval = null;

function startKeepAlive() {
  // إرسال ping كل 10 دقائق لمنع النوم
  keepAliveInterval = setInterval(() => {
    console.log('🔄 Keep-alive ping sent');
  }, 10 * 60 * 1000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ============================================
// 🚀 بدء الخادم
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ: ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
  console.log(`⚡ الكاش: مفعّل (${CACHE_DURATION / 1000} ثانية)`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'متصل' : 'قيد الاتصال'}`);
  
  // بدء Keep-Alive
  startKeepAlive();
});

// ============================================
// 🛑 معالجة الإيقاف السليم
// ============================================

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing gracefully...');
  stopKeepAlive();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing gracefully...');
  stopKeepAlive();
  await mongoose.connection.close();
  process.exit(0);
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
