// アイコン文字列 → Image の uri を返す
// - https:// で始まる → そのまま URL として使う
// - それ以外 → base64 データ URI として扱う
// - 空文字 → null（プレースホルダー表示）
export function resolveIconUri(icon: string | undefined | null): string | null {
  if (!icon) return null;
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon;
  if (icon.startsWith('data:')) return icon;
  return `data:image/png;base64,${icon}`;
}

// pravatar.cc — シード文字列から一貫したリアル人物顔写真 URL を生成
// DALL-E 生成失敗時のフォールバック。同じ seed は常に同じ顔を返す。
export function diceBearUrl(seed: string): string {
  return `https://i.pravatar.cc/128?u=${encodeURIComponent(seed)}`;
}
