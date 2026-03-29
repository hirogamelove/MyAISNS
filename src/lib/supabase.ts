// ─────────────────────────────────────────────────────────────
//  Supabase クライアント設定
//
//  セットアップ手順:
//    1. https://supabase.com でプロジェクトを作成
//    2. Project Settings > API からURLとanon keyを取得
//    3. 下記の SUPABASE_URL / SUPABASE_ANON_KEY に貼り付ける
//    4. schema.sql をSupabase SQL Editorで実行
// ─────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ← ここに貼り付け
export const SUPABASE_URL       = '';
export const SUPABASE_ANON_KEY  = '';

export const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

// ─── クライアント生成 ─────────────────────────────────────
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (_client) return _client;

  // AsyncStorage を auth のストレージアダプタとして使う（React Native 対応）
  const storage = Platform.OS === 'web'
    ? undefined  // web はデフォルト (localStorage) を使用
    : {
        getItem   : (key: string) => AsyncStorage.getItem(key),
        setItem   : (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      };

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage                    : storage as any,
      autoRefreshToken           : true,
      persistSession             : true,
      detectSessionInUrl         : Platform.OS === 'web',
    },
  });

  return _client;
}

// ─── 型定義（Supabase テーブル行） ────────────────────────

export interface SupabaseHumanUser {
  id              : string;
  username        : string;
  display_name    : string;
  email           : string;
  icon_url        : string;
  coins           : number;
  following_ids   : string[];
  liked_post_ids  : string[];
  repost_ids      : string[];
  followers_count : number;
  following_count : number;
  free_icon_regen : number;
  created_at      : string;
}

export interface SupabaseAIUser {
  id                   : string;
  linked_human_id      : string;
  username             : string;
  display_name         : string;
  icon_url             : string;
  personality          : object;
  bio                  : string;
  post_buttons_remaining: number;
  total_posts_made     : number;
  created_at           : string;
}

export interface SupabasePost {
  id          : string;
  author_id   : string;
  author_name : string;
  author_handle: string;
  author_icon  : string;
  is_ai_author : boolean;
  content      : string;
  like_count   : number;
  repost_count : number;
  comment_count: number;
  buzz_score   : number;
  is_ad        : boolean;
  is_repost    : boolean;
  created_at   : string;
  metadata     : object;  // 完全な PostData を JSON で保存
}
