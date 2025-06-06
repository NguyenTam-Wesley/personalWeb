// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3000;

// Xử lý __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve các file tĩnh
app.use(express.static(__dirname));

// Route mặc định
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
});

app.listen(port, () => {
  console.log(`Server đang chạy ở http://localhost:${port}`);
});
