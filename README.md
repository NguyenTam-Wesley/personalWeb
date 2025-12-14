# NTAM Web

Dự án website cá nhân sử dụng Express.js và Supabase.

## Yêu cầu hệ thống

- Node.js (phiên bản 16 trở lên)
- npm hoặc yarn
- Tài khoản Supabase

## Cài đặt

1. Clone repository:
```bash
git clone https://github.com/NguyenTam-Wesley/personalWeb.git
cd personalWeb
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file .env trong thư mục gốc và thêm các biến môi trường:
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

4. Chạy dự án ở môi trường development:
```bash
npm run dev
```

5. Build và chạy ở môi trường production:
```bash
npm run build
npm start
```

## Cấu trúc dự án

```
├── public/          # Static files
├── server/          # Backend code
├── src/            # Source code
├── style/          # CSS styles
└── data/           # Data files
```

## API Documentation

### Endpoints

- `GET /`: Trang chủ
- `GET /public/pages/*`: Các trang tĩnh

## Development

- Sử dụng ESLint và Prettier cho code formatting
- Chạy tests: `npm test`
- Build: `npm run build`

## License

ISC
