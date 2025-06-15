// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3000;

// Xử lý __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

// Serve các file tĩnh từ thư mục public
app.use(express.static(publicPath));

// Route mặc định
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Route cho các trang khác
app.get("/pages/*", (req, res) => {
  res.sendFile(path.join(publicPath, req.path));
});

app.listen(port, () => {
  console.log(`Server đang chạy ở http://localhost:${port}`);
});
