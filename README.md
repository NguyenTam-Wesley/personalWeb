## Dự án website cá nhân sử dụng Javascript và Supabase.

## Cài đặt

1. Clone repository:

```bash
git clone https://github.com/NguyenTam-Wesley/personalWeb.git
cd personalWeb
```

1. Cài đặt dependencies:

```bash
npm install
```

1. Tạo file .env trong thư mục gốc và thêm các biến môi trường:

```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

1. Chạy dự án ở môi trường development:

```bash
npm run dev
```

1. Build và chạy:

```bash
npm run build
npm start
```

## Cấu trúc dự án

```
Thập cẩm
```

## API Documentation

### Endpoints

- `GET /`: Trang chủ
- `GET /pages/*`: Các trang tĩnh

## Development

- Sử dụng ESLint và Prettier cho code formatting
- Chạy tests: `npm test`
- Build: `npm run build`

## License

MIT