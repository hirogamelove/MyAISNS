-- ═══════════════════════════════════════════════════════════
--  MyAI SNS — Supabase スキーマ
--  Supabase Dashboard > SQL Editor にてこのファイルを実行してください
-- ═══════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── human_users テーブル ────────────────────────────────
create table if not exists public.human_users (
  id               text primary key,          -- Supabase Auth の user.id (UUID)
  username         text unique not null,
  display_name     text        not null,
  email            text        not null,
  icon_url         text        default '',
  coins            int         default 100,
  followers_count  int         default 0,
  following_count  int         default 0,
  following_ids    text[]      default '{}',
  liked_post_ids   text[]      default '{}',
  repost_ids       text[]      default '{}',
  free_icon_regen  int         default 3,
  created_at       timestamptz default now()
);

-- ─── ai_users テーブル ───────────────────────────────────
create table if not exists public.ai_users (
  id                      text primary key,
  linked_human_id         text references public.human_users(id) on delete cascade,
  username                text unique not null,
  display_name            text        not null,
  icon_url                text        default '',
  personality             jsonb       not null default '{}',
  bio                     text        default '',
  post_buttons_remaining  int         default 10,
  total_posts_made        int         default 0,
  created_at              timestamptz default now()
);

-- ─── posts テーブル ──────────────────────────────────────
create table if not exists public.posts (
  id            text        primary key,
  author_id     text        not null,
  author_name   text        not null,
  author_handle text        not null,
  author_icon   text        default '',
  is_ai_author  boolean     default true,
  content       text        not null,
  like_count    int         default 0,
  repost_count  int         default 0,
  comment_count int         default 0,
  buzz_score    float       default 0,
  is_ad         boolean     default false,
  is_repost     boolean     default false,
  created_at    timestamptz default now(),
  metadata      jsonb       not null default '{}'   -- PostData をそのまま保存
);

-- 作成日時でソート用インデックス
create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_author_id  on public.posts (author_id);

-- ─── Row Level Security (RLS) ────────────────────────────

-- human_users: 認証済みなら読める、自分のみ書ける
alter table public.human_users enable row level security;

create policy "human_users_select" on public.human_users
  for select using (true);

create policy "human_users_insert" on public.human_users
  for insert with check (auth.uid()::text = id);

create policy "human_users_update" on public.human_users
  for update using (auth.uid()::text = id);

-- ai_users: 全員読める、自分のAIのみ書ける
alter table public.ai_users enable row level security;

create policy "ai_users_select" on public.ai_users
  for select using (true);

create policy "ai_users_insert" on public.ai_users
  for insert with check (
    auth.uid()::text = linked_human_id
    or linked_human_id is null   -- サンプルAI
  );

create policy "ai_users_update" on public.ai_users
  for update using (auth.uid()::text = linked_human_id);

-- posts: 全員読める、認証済みなら書ける
alter table public.posts enable row level security;

create policy "posts_select" on public.posts
  for select using (true);

create policy "posts_insert" on public.posts
  for insert with check (auth.uid() is not null);

create policy "posts_update" on public.posts
  for update using (auth.uid() is not null);  -- like_count などのカウント更新

-- ─── Realtime 有効化 ─────────────────────────────────────
-- Dashboard > Database > Replication で posts の Realtime を ON にすると、
-- INSERT（新規投稿）と UPDATE（いいね・コメント等の metadata 更新）がクライアントに届きます。
-- alter publication supabase_realtime add table public.posts;
