import { PROXY_BASE_URL, PROXY_SECRET } from '../constants';
import { PersonalityProfile } from '../types';
import { generateAvatarPrompt } from './personalityService';
import { COLORS } from '../constants';

// ─── DALL-E プロキシでアバター URL を取得 ────────────────
export async function generateAvatarUrl(
  profile: PersonalityProfile,
  displayName: string
): Promise<string | null> {
  const prompt  = generateAvatarPrompt(profile, displayName);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROXY_SECRET) headers['X-App-Secret'] = PROXY_SECRET;

  try {
    const res = await fetch(`${PROXY_BASE_URL}/api/generate-avatar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data.url as string;
  } catch (e) {
    console.warn('[Avatar] 生成失敗:', e);
    return null;
  }
}

// ─── 性格からプレースホルダー色を生成 ───────────────────
export function getPlaceholderColor(profile: PersonalityProfile): string {
  const hue = Math.floor(profile.extraversion * 360);
  const sat = Math.floor(50  + profile.openness      * 40);
  const lig = Math.floor(40  + profile.agreeableness * 20);
  return `hsl(${hue}, ${sat}%, ${lig}%)`;
}

// ─── イニシャルアバター用テキストカラー ─────────────────
export function getInitials(displayName: string): string {
  return displayName.slice(0, 2);
}
