import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import connectDB from './config/Db.js';
import user from './Router/UserRouter.js';
import website from './Router/WebsiteRouter.js';
import googleAuth from './Router/GoogleAuthRouter.js';
import order from './Router/OrderRouter.js';
import admin from './Router/AdminRouter.js';
import advertiser from './Router/AdvertiserRouter.js';
import wallet from './Router/WalletRouter.js';
import chat from './Router/ChatRouter.js';
// import payment from './Router/PaymentRouter.js';  // Comment out for now
import notification from './Router/NotificationRouter.js';
import quality from './Router/QualityRouter.js';
import files from './Router/FileRouter.js';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import SocketService from './services/SocketService.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = createServer(app);

// ✅ Connect MongoDB
connectDB();

// ✅ Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5500','http://localhost:5173', 'http://localhost:5500'], // Add your frontend URLs
  credentials: true,                    // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());             // Parse JSON body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(morgan('dev'));              // Log requests to console
app.use(helmet());  
app.use(cookieParser());

// ✅ Routes - Order matters! More specific routes should come first
app.use('/api/v1/advertiser', advertiser);  // Advertiser routes first (more specific)
app.use('/api/v1/admin', admin);            // Admin routes second (more specific)
app.use('/api/v1', user);                   // User routes
app.use('/api/v1/websites', website);       // Website routes
app.use('/api/v1/auth', googleAuth);        // Google auth routes
app.use('/api/v1/orders', order);           // Order routes
app.use('/api/v1/wallet', wallet);          // Wallet routes
app.use('/api/v1/chat', chat);              // Chat routes
// app.use('/api/v1/payment', payment);     // Payment routes (commented out)
app.use('/api/v1/notification', notification); // Notification routes
app.use('/api/v1/quality', quality);        // Quality routes
app.use('/api/v1', files);                  // File routes

app.get('/', (req, res) => {
  res.send('👋 Hello Sheraz! Express server is running.');
});

// ✅ Global Error Handler (optional but recommended)
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message,
  });
});

// ✅ Start Server
console.log('Environment variables:', process.env.PORT);
const PORT = process.env.PORT || 3000;
console.log('Server will start on port:', PORT);
server.listen(PORT, () => {
  console.log(`🚀 Server is running at: http://localhost:${PORT}`);
  
  // Initialize WebSocket server
  SocketService.initialize(server);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
});