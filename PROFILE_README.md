# Trang Profile - NTAM

## Tổng quan
Trang Profile cho phép người dùng đã đăng nhập quản lý thông tin cá nhân của mình, bao gồm cập nhật thông tin cá nhân, đổi mật khẩu và xem thống kê tài khoản.

## Tính năng

### 1. Thông tin cá nhân
- **Tên đăng nhập**: Hiển thị và không thể chỉnh sửa
- **Email**: Có thể cập nhật email mới
- **Họ và tên**: Có thể thêm/sửa họ tên đầy đủ
- **Giới thiệu**: Có thể viết giới thiệu về bản thân

### 2. Đổi mật khẩu
- Yêu cầu nhập mật khẩu hiện tại
- Nhập mật khẩu mới (tối thiểu 6 ký tự)
- Xác nhận mật khẩu mới
- Validation đầy đủ để đảm bảo an toàn

### 3. Thống kê tài khoản
- **Số lần đăng nhập**: Tự động cập nhật mỗi khi đăng nhập
- **Ngày tham gia**: Thời gian tạo tài khoản
- **Vai trò**: Role hiện tại của user

## Cấu trúc file

```
public/
├── pages/
│   └── profile.html          # Trang profile chính
├── style/
│   └── profile.css           # CSS cho trang profile
└── js/
    └── modules/
        └── profile.js        # Logic xử lý profile
```

## Cài đặt Database

### 1. Chạy SQL Script
Chạy file `database_update.sql` trong Supabase SQL Editor để:
- Thêm các cột mới vào bảng `users`
- Tạo index và trigger
- Cập nhật RLS policies

### 2. Cấu trúc bảng users sau khi cập nhật
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    email TEXT,
    full_name TEXT,
    bio TEXT,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Sử dụng

### 1. Truy cập trang Profile
- Đăng nhập vào hệ thống
- Click vào tên user trong header
- Chọn "Profile" từ dropdown menu

### 2. Cập nhật thông tin
- Điền thông tin vào các trường
- Click "Lưu thông tin"
- Hệ thống sẽ hiển thị thông báo thành công/lỗi

### 3. Đổi mật khẩu
- Nhập mật khẩu hiện tại
- Nhập mật khẩu mới
- Xác nhận mật khẩu mới
- Click "Đổi mật khẩu"

## Bảo mật

### 1. Authentication
- Chỉ user đã đăng nhập mới có thể truy cập
- Tự động chuyển hướng về trang login nếu chưa đăng nhập

### 2. Authorization
- User chỉ có thể xem và cập nhật thông tin của chính mình
- RLS policies đảm bảo quyền truy cập

### 3. Validation
- Email được validate format
- Mật khẩu mới phải có ít nhất 6 ký tự
- Mật khẩu hiện tại phải đúng để đổi mật khẩu

## Responsive Design

Trang profile được thiết kế responsive và hoạt động tốt trên:
- Desktop (>= 1024px)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## Tích hợp

### 1. Header Navigation
- Link Profile được thêm vào dropdown menu
- Tự động highlight khi ở trang profile
- Đường dẫn được xử lý đúng cho các trang con

### 2. Authentication System
- Tích hợp với hệ thống auth hiện tại
- Tự động cập nhật login_count
- Lưu trữ thông tin user trong localStorage

## Troubleshooting

### 1. Lỗi "Không thể tải thông tin profile"
- Kiểm tra kết nối database
- Đảm bảo user đã đăng nhập
- Kiểm tra RLS policies

### 2. Lỗi "Email không hợp lệ"
- Kiểm tra format email
- Đảm bảo email có đuôi domain hợp lệ

### 3. Lỗi "Mật khẩu hiện tại không đúng"
- Kiểm tra mật khẩu đã nhập
- Đảm bảo không có khoảng trắng thừa

## Tương lai

Có thể mở rộng thêm các tính năng:
- Upload avatar
- Cài đặt thông báo
- Lịch sử hoạt động
- Kết nối mạng xã hội
- Backup và restore dữ liệu 