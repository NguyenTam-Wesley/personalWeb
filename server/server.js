// server.js
import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./auth.js";


const app = express();
const port = process.env.PORT || 3000;

// Xử lý __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],

      imgSrc: [
        "'self'",
        "https://cdn.glitch.global",
        "https://calwzopyjitbtahiafzw.supabase.co",
        "data:"
      ],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net"
      ],

      scriptSrcAttr: ["'unsafe-inline'"],

      connectSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://calwzopyjitbtahiafzw.supabase.co"
      ],

      mediaSrc: [
        "'self'",
        "https://cdn.glitch.global",
        "https://archive.org",
        "https://*.archive.org",
      ],

      workerSrc: ["'self'", "blob:"]
    },
  })
);

// Auth API routes
app.use('/auth', authRoutes);

// Serve các file tĩnh từ thư mục public
app.use(express.static(publicPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('_worker.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Route mặc định
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  // Only return 404 JSON for API routes
  if (req.path.startsWith('/auth/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  } else {
    // Serve index.html for client-side routing
    res.sendFile(path.join(publicPath, "index.html"));
  }
});

app.listen(port, () => {
  console.log(`🚀 Server đang chạy ở http://localhost:${port}`);
  console.log(`📡 Auth API available at http://localhost:${port}/auth`);
});
