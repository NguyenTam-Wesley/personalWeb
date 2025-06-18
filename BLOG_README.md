# Trang Blog - NTAM

## Tổng quan
Trang Blog cho phép admin viết và đăng bài viết, người dùng có thể đọc và tìm kiếm bài viết theo danh mục.

## Tính năng

### 1. Cho Admin
- **Viết bài mới**: Modal form để tạo bài viết
- **Quản lý nội dung**: Tiêu đề, tóm tắt, nội dung, danh mục, tags
- **Phân quyền**: Chỉ admin mới có thể tạo bài viết

### 2. Cho người dùng
- **Xem bài viết**: Danh sách bài viết với pagination
- **Tìm kiếm**: Tìm kiếm theo từ khóa
- **Lọc theo danh mục**: Công nghệ, Gaming, Âm nhạc, Học tập, Cuộc sống
- **Sắp xếp**: Mới nhất, Cũ nhất, Phổ biến

### 3. Tính năng chung
- **Responsive design**: Hoạt động tốt trên mọi thiết bị
- **Loading states**: Hiển thị trạng thái tải
- **Empty states**: Thông báo khi không có bài viết

## Cấu trúc file

```
public/
├── pages/
│   └── blog.html              # Trang blog chính
├── style/
│   └── blog.css               # CSS cho trang blog
└── js/
    └── modules/
        └── blog.js            # Logic xử lý blog
```

## Cài đặt Database

### 1. Chạy SQL Script
Chạy file `blog_database.sql` trong Supabase SQL Editor để:
- Tạo bảng `blog_posts`
- Tạo index và trigger
- Cập nhật RLS policies
- Tạo bài viết mẫu

### 2. Cấu trúc bảng blog_posts
```sql
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    tags TEXT,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Sử dụng

### 1. Truy cập trang Blog
- Click vào "Blog" trong navigation menu
- Hoặc truy cập trực tiếp: `/pages/blog.html`

### 2. Xem bài viết
- Danh sách bài viết hiển thị với thông tin:
  - Tiêu đề
  - Danh mục
  - Ngày đăng
  - Tác giả
  - Số lượt xem
  - Tóm tắt
  - Tags

### 3. Tìm kiếm và lọc
- **Tìm kiếm**: Nhập từ khóa vào ô tìm kiếm
- **Lọc danh mục**: Chọn danh mục từ dropdown
- **Sắp xếp**: Chọn cách sắp xếp (mới nhất/cũ nhất/phổ biến)

### 4. Tạo bài viết (Admin)
- Click nút "Viết bài mới" (chỉ hiển thị cho admin)
- Điền thông tin:
  - **Tiêu đề**: Bắt buộc
  - **Danh mục**: Bắt buộc
  - **Tóm tắt**: Tùy chọn
  - **Nội dung**: Bắt buộc
  - **Tags**: Phân cách bằng dấu phẩy
- Click "Đăng bài"

## Danh mục bài viết

- **Công nghệ**: Chia sẻ về lập trình, công nghệ mới
- **Gaming**: Review game, tips và tricks
- **Âm nhạc**: Chia sẻ về âm nhạc yêu thích
- **Học tập**: Kinh nghiệm học tập và phát triển bản thân
- **Cuộc sống**: Những câu chuyện thú vị trong cuộc sống

## Bảo mật

### 1. Phân quyền
- **Public**: Tất cả người dùng có thể xem bài viết
- **Admin only**: Chỉ admin có thể tạo, sửa, xóa bài viết

### 2. RLS Policies
- `Allow public read blog posts`: Cho phép đọc tất cả bài viết
- `Allow admin create blog posts`: Chỉ admin tạo bài viết
- `Allow admin update own blog posts`: Admin sửa bài viết của mình
- `Allow admin delete own blog posts`: Admin xóa bài viết của mình

### 3. Validation
- Tiêu đề và nội dung bắt buộc
- Danh mục phải hợp lệ
- Escape HTML để tránh XSS

## Responsive Design

Trang blog được thiết kế responsive và hoạt động tốt trên:
- Desktop (>= 1024px)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## Tích hợp

### 1. Navigation
- Link Blog được thêm vào header navigation
- Tự động highlight khi ở trang blog
- Đường dẫn được xử lý đúng cho các trang con

### 2. Authentication System
- Tích hợp với hệ thống auth hiện tại
- Kiểm tra role admin để hiển thị nút tạo bài
- Lưu author_id khi tạo bài viết

## Pagination

- **Posts per page**: 6 bài viết
- **Navigation**: Trước/Sau với số trang
- **Auto-hide**: Ẩn pagination khi chỉ có 1 trang

## Troubleshooting

### 1. Lỗi "Không thể tải bài viết"
- Kiểm tra kết nối database
- Kiểm tra RLS policies
- Kiểm tra bảng `blog_posts` đã được tạo

### 2. Nút "Viết bài mới" không hiển thị
- Đảm bảo user đã đăng nhập
- Kiểm tra role của user có phải là 'admin'
- Kiểm tra console có lỗi JavaScript không

### 3. Lỗi khi tạo bài viết
- Kiểm tra form validation
- Đảm bảo đã điền đầy đủ thông tin bắt buộc
- Kiểm tra quyền admin

## Tương lai

Có thể mở rộng thêm các tính năng:
- **Trang chi tiết bài viết**: Hiển thị nội dung đầy đủ
- **Bình luận**: Cho phép user bình luận
- **Like/Share**: Tương tác với bài viết
- **Rich text editor**: Editor WYSIWYG cho nội dung
- **Upload ảnh**: Thêm ảnh vào bài viết
- **SEO optimization**: Meta tags, sitemap
- **RSS feed**: Cho phép subscribe
- **Email notification**: Thông báo bài viết mới 