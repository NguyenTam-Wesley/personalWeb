-- Bảng tác giả
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT
);

-- Bảng thể loại
CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- Bảng tiểu thuyết
CREATE TABLE novels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('ongoing', 'completed', 'paused')) NOT NULL,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng trung gian giữa novels và genres (nhiều-nhiều)
CREATE TABLE novel_genres (
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  genre_id UUID REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (novel_id, genre_id)
);

-- Bảng quyển trong tiểu thuyết
CREATE TABLE volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  title TEXT,
  "order" INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng chương trong quyển
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  "order" INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng đánh dấu chương đã đọc (bookmark)
CREATE TABLE bookmarked_chapters (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);

-- Bảng tiểu thuyết yêu thích (favorite)
CREATE TABLE favorite_novels (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, novel_id)
);
CREATE INDEX idx_chapters_volume_id ON chapters(volume_id);
CREATE INDEX idx_volumes_novel_id ON volumes(novel_id);
CREATE INDEX idx_novels_author_id ON novels(author_id);
CREATE INDEX idx_bookmarked_user ON bookmarked_chapters(user_id);
CREATE INDEX idx_favorite_user ON favorite_novels(user_id);
