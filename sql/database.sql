-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.artist (
  name text NOT NULL,
  id integer NOT NULL DEFAULT nextval('artist_id_seq'::regclass),
  CONSTRAINT artist_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blog_posts (
  title text NOT NULL,
  summary text,
  content text NOT NULL,
  tags text,
  author_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general'::text,
  view_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id),
  CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id)
);
CREATE TABLE public.crosshairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text DEFAULT 'pro'::text,
  name text NOT NULL,
  description text,
  code text NOT NULL,
  player_name text,
  team_name text,
  color text,
  style text,
  difficulty text DEFAULT 'medium'::text,
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crosshairs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.document_types (
  name character varying NOT NULL UNIQUE,
  id integer NOT NULL DEFAULT nextval('document_types_id_seq'::regclass),
  CONSTRAINT document_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.documents (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  subject_id integer,
  title text NOT NULL,
  url text NOT NULL,
  type_id integer,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT fk_document_type FOREIGN KEY (type_id) REFERENCES public.document_types(id),
  CONSTRAINT documents_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.game_progress (
  user_id uuid,
  id integer NOT NULL DEFAULT nextval('game_progress_id_seq'::regclass),
  level integer DEFAULT 1,
  items jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT game_progress_pkey PRIMARY KEY (id),
  CONSTRAINT game_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.genre (
  name text NOT NULL,
  id integer NOT NULL DEFAULT nextval('genre_id_seq'::regclass),
  CONSTRAINT genre_pkey PRIMARY KEY (id)
);
CREATE TABLE public.music_data (
  song_name text NOT NULL,
  url text NOT NULL,
  id integer NOT NULL DEFAULT nextval('music_data_id_seq'::regclass),
  artist_id integer,
  genre_id integer,
  region_id integer,
  CONSTRAINT music_data_pkey PRIMARY KEY (id),
  CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES public.artist(id),
  CONSTRAINT fk_genre FOREIGN KEY (genre_id) REFERENCES public.genre(id),
  CONSTRAINT fk_region FOREIGN KEY (region_id) REFERENCES public.region(id)
);
CREATE TABLE public.playlist (
  name text NOT NULL,
  user_id uuid,
  id integer NOT NULL DEFAULT nextval('playlist_id_seq'::regclass),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT playlist_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.playlist_song (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  playlist_id bigint NOT NULL,
  song_id bigint NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT playlist_song_pkey PRIMARY KEY (id),
  CONSTRAINT fk_playlist FOREIGN KEY (playlist_id) REFERENCES public.playlist(id),
  CONSTRAINT fk_song FOREIGN KEY (song_id) REFERENCES public.music_data(id)
);
CREATE TABLE public.region (
  name text NOT NULL,
  id integer NOT NULL DEFAULT nextval('region_id_seq'::regclass),
  CONSTRAINT region_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subjects (
  id integer NOT NULL DEFAULT nextval('subjects_id_seq'::regclass),
  name text NOT NULL,
  type text DEFAULT 'slide'::text,
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  email text,
  full_name text,
  bio text,
  login_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'user'::text])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);