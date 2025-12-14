// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";

const app = express();
const port = process.env.PORT || 3000;

// Xử lý __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],

      imgSrc: ["'self'", "https://cdn.glitch.global", "data:"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net"
      ],

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


// Serve các file tĩnh từ thư mục public
app.use(express.static(publicPath));

// Route mặc định
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server đang chạy ở http://localhost:${port}`);
});
