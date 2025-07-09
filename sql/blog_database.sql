-- Tạo bảng blog_posts cho hệ thống blog
-- Chạy các lệnh SQL này trong Supabase SQL Editor

-- Tạo bảng blog_posts
CREATE TABLE IF NOT EXISTS blog_posts (
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

-- Tạo index cho các trường thường query
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_view_count ON blog_posts(view_count);

-- Tạo function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tạo trigger để tự động cập nhật updated_at khi có thay đổi
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_posts_updated_at();

-- Tạo function để tăng view_count
CREATE OR REPLACE FUNCTION increment_blog_post_views(post_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE blog_posts 
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = post_id;
END;
$$ language 'plpgsql';

-- Cập nhật RLS (Row Level Security)
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Policy cho phép đọc tất cả bài viết (public)
DROP POLICY IF EXISTS "Allow public read blog posts" ON blog_posts;
CREATE POLICY "Allow public read blog posts" ON blog_posts
    FOR SELECT USING (true);

-- Policy cho phép admin tạo bài viết
DROP POLICY IF EXISTS "Allow admin create blog posts" ON blog_posts;
CREATE POLICY "Allow admin create blog posts" ON blog_posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = blog_posts.author_id 
            AND users.role = 'admin'
        )
    );

-- Policy cho phép admin cập nhật bài viết của mình
DROP POLICY IF EXISTS "Allow admin update own blog posts" ON blog_posts;
CREATE POLICY "Allow admin update own blog posts" ON blog_posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = blog_posts.author_id 
            AND users.role = 'admin'
        )
    );

-- Policy cho phép admin xóa bài viết của mình
DROP POLICY IF EXISTS "Allow admin delete own blog posts" ON blog_posts;
CREATE POLICY "Allow admin delete own blog posts" ON blog_posts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = blog_posts.author_id 
            AND users.role = 'admin'
        )
    );

-- Thêm comment cho các cột
COMMENT ON COLUMN blog_posts.title IS 'Tiêu đề bài viết';
COMMENT ON COLUMN blog_posts.summary IS 'Tóm tắt bài viết';
COMMENT ON COLUMN blog_posts.content IS 'Nội dung bài viết';
COMMENT ON COLUMN blog_posts.category IS 'Danh mục bài viết';
COMMENT ON COLUMN blog_posts.tags IS 'Tags phân cách bằng dấu phẩy';
COMMENT ON COLUMN blog_posts.author_id IS 'ID của tác giả';
COMMENT ON COLUMN blog_posts.view_count IS 'Số lượt xem';
COMMENT ON COLUMN blog_posts.created_at IS 'Thời gian tạo bài viết';
COMMENT ON COLUMN blog_posts.updated_at IS 'Thời gian cập nhật cuối cùng';

-- Tạo một số bài viết mẫu (nếu có user admin)
INSERT INTO blog_posts (title, summary, content, category, tags, author_id) 
SELECT 
    'Chào mừng đến với Blog NTAM',
    'Bài viết đầu tiên giới thiệu về blog của NTAM',
    'Đây là nội dung bài viết đầu tiên. Blog này sẽ là nơi chia sẻ kiến thức và trải nghiệm về công nghệ, gaming, âm nhạc và nhiều chủ đề thú vị khác.

Chúng ta sẽ có các danh mục:
- Công nghệ: Chia sẻ về lập trình, công nghệ mới
- Gaming: Review game, tips và tricks
- Âm nhạc: Chia sẻ về âm nhạc yêu thích
- Học tập: Kinh nghiệm học tập và phát triển bản thân
- Cuộc sống: Những câu chuyện thú vị trong cuộc sống

Hãy theo dõi để cập nhật những bài viết mới nhất!',
    'general',
    'blog, giới thiệu, NTAM',
    users.id
FROM users 
WHERE users.role = 'admin' 
LIMIT 1; 