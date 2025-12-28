# Sudoku Scores Setup Guide

## 1. Tạo bảng sudoku_scores trong Supabase

Chạy SQL sau trong Supabase SQL Editor:

```sql
-- Tạo bảng sudoku_scores
CREATE TABLE IF NOT EXISTS sudoku_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard', 'expert')),
    best_time INTEGER NOT NULL CHECK (best_time > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Đảm bảo mỗi user chỉ có 1 record cho mỗi độ khó
    UNIQUE(user_id, difficulty)
);

-- Tạo index để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_sudoku_scores_user_id ON sudoku_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_scores_difficulty ON sudoku_scores(difficulty);

-- Tạo RLS (Row Level Security) policies
ALTER TABLE sudoku_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users chỉ có thể xem/thêm/sửa record của chính mình
CREATE POLICY "Users can view their own scores" ON sudoku_scores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scores" ON sudoku_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores" ON sudoku_scores
    FOR UPDATE USING (auth.uid() = user_id);

-- Function để tự động update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger để tự động update updated_at
CREATE TRIGGER update_sudoku_scores_updated_at
    BEFORE UPDATE ON sudoku_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 2. Files đã được tạo/cập nhật

### Files mới:
- `public/js/modules/sudoku_scores.js` - Xử lý lưu/xem thành tích
- `sudoku_scores_schema.sql` - Schema database

### Files đã cập nhật:
- `public/js/modules/sudoku.js` - Tích hợp sudoku_scores
- `public/js/modules/sudoku_entry.js` - Import sudoku_scores
- `public/pages/games/sudoku/sudoku.html` - Thêm UI best time & achievements
- `public/style/sudoku.css` - CSS cho best time & achievements

## 3. Tính năng mới

### ✅ Best Time Display
- Hiển thị thành tích tốt nhất cho độ khó hiện tại
- Tự động cập nhật khi thay đổi độ khó
- Format MM:SS đẹp mắt

### ✅ Auto Save Best Scores
- Tự động lưu khi hoàn thành game
- Chỉ lưu nếu thời gian tốt hơn thành tích cũ
- Thông báo khi phá record

### ✅ Achievements Dropdown
- Xem tất cả thành tích của user
- Hiển thị cho tất cả 5 độ khó
- Responsive và đẹp mắt

## 4. Cách hoạt động

1. **User đăng nhập** → `sudoku_scores` tự động lấy thông tin user
2. **Chọn độ khó** → Hiển thị best time cho độ khó đó
3. **Hoàn thành game** → Tự động so sánh và lưu best time
4. **Click "Thành tích"** → Xem tất cả records

## 5. Security & Performance

- ✅ **RLS enabled** - Chỉ user chính chủ mới xem/sửa được data
- ✅ **Unique constraint** - Mỗi user chỉ có 1 record/độ khó
- ✅ **Indexes** - Query nhanh
- ✅ **Auto timestamps** - Tracking created/updated

## 6. Testing

1. Đăng nhập vào app
2. Chơi Sudoku và hoàn thành 1 game
3. Kiểm tra best time hiển thị
4. Click "Thành tích" xem dropdown
5. Thay đổi độ khó và kiểm tra best time cập nhật

**Setup hoàn tất! Sudoku giờ có hệ thống thành tích đầy đủ! 🏆**
