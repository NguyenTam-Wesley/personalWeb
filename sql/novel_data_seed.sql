-- Tác giả
INSERT INTO authors (id, name, bio)
VALUES (
  gen_random_uuid(),
  'Nguyễn Tâm',
  'Tác giả chuyên viết truyện lãng mạn pha hiện thực. Yêu mùa hè, thích viết về những điều tưởng như đã mất.'
);

-- Lấy ID tác giả vừa tạo
-- Supabase không hỗ trợ biến SQL trực tiếp nên bạn có thể copy lại `id` nếu chạy riêng từng phần.
-- Hoặc dùng CTE nếu gộp vào file chạy cùng lúc (dưới đây đã giả lập tạm)

-- Giả lập ID thủ công để dễ xử lý (nếu bạn chạy tất cả cùng lúc)
-- (Hoặc thay thế bằng ID thật bạn lấy từ bảng `authors` nếu chạy riêng)
-- Bạn có thể sửa ID này nếu muốn tự định danh khác
-- UUID tạo sẵn:
--   123e4567-e89b-12d3-a456-426614174000

-- Thể loại
INSERT INTO genres (id, name) VALUES
  (gen_random_uuid(), 'Tình cảm'),
  (gen_random_uuid(), 'Thanh xuân');

-- Lấy ID của 2 genre vừa tạo:
-- (giả sử):
--   'Tình cảm':   123e4567-e89b-12d3-a456-426614174001
--   'Thanh xuân':123e4567-e89b-12d3-a456-426614174002

-- Truyện
INSERT INTO novels (id, title, author_id, status, summary)
VALUES (
  '123e4567-e89b-12d3-a456-426614174100',
  'Ký Ức Mùa Hè',
  (SELECT id FROM authors WHERE name = 'Nguyễn Tâm'),
  'ongoing',
  'Một câu chuyện nhẹ nhàng về những ngày hè cuối cấp, nơi ký ức và lựa chọn giao nhau.'
);

-- Gắn truyện với thể loại (giả lập UUID genre)
INSERT INTO novel_genres (novel_id, genre_id) VALUES
  ('123e4567-e89b-12d3-a456-426614174100', (SELECT id FROM genres WHERE name = 'Tình cảm')),
  ('123e4567-e89b-12d3-a456-426614174100', (SELECT id FROM genres WHERE name = 'Thanh xuân'));

-- Quyển đầu tiên
INSERT INTO volumes (id, novel_id, title, "order")
VALUES (
  gen_random_uuid(),
  '123e4567-e89b-12d3-a456-426614174100',
  'Quyển 1: Những Ngày Nắng Cháy',
  1
);

-- Lấy ID volume vừa tạo
-- (hoặc thay thủ công, ví dụ: '123e4567-e89b-12d3-a456-426614174200')

-- Giả lập lấy volume_id theo title
-- Chương đầu tiên
INSERT INTO chapters (id, volume_id, title, content, "order") VALUES
(
  gen_random_uuid(),
  (SELECT id FROM volumes WHERE title = 'Quyển 1: Những Ngày Nắng Cháy'),
  'Chương 1: Ve Kêu Trên Sân Trường',
  'Tiếng ve râm ran như kéo dài những ngày cuối cùng của tuổi học trò...',
  1
),
(
  gen_random_uuid(),
  (SELECT id FROM volumes WHERE title = 'Quyển 1: Những Ngày Nắng Cháy'),
  'Chương 2: Lần Cuối Nắm Tay',
  'Chúng tôi bước đi bên nhau, chẳng nói gì, nhưng trái tim lại vang lên nhiều điều chưa kịp nói...',
  2
);
