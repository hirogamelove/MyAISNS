import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE } from '../constants';
import { PostData } from '../types';
import { useTheme, ThemeColors } from '../theme';

interface TrendEntry {
  tag:   string;
  count: number;
  score: number;
}

// ─── 全投稿からトレンドハッシュタグを算出 ──────────────
// スコア = 出現回数 + buzzScore の合計（バズ投稿のタグを優遇）
const TAG_REGEX = /#[\w\u3000-\u9FFF\uF900-\uFAFF]+/g;

export function calcTrending(posts: PostData[], limit = 10): TrendEntry[] {
  const map = new Map<string, { count: number; score: number }>();

  for (const post of posts) {
    const tags = post.content.match(TAG_REGEX) ?? [];
    for (const raw of tags) {
      const tag = raw.toLowerCase();
      const prev = map.get(tag) ?? { count: 0, score: 0 };
      map.set(tag, {
        count: prev.count + 1,
        score: prev.score + 1 + post.buzzScore * 4,
      });
    }
  }

  return Array.from(map.entries())
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

interface Props {
  posts:       PostData[];
  selectedTag: string | null;
  onSelect:    (tag: string | null) => void;
}

export default function TrendingBar({ posts, selectedTag, onSelect }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const trends = useMemo(() => calcTrending(posts), [posts]);

  if (trends.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Ionicons name="flame" size={13} color={C.gold} />
        <Text style={styles.label}>トレンド</Text>
        {selectedTag && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => onSelect(null)}>
            <Ionicons name="close-circle" size={14} color={C.textSub} />
            <Text style={styles.clearText}>解除</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {trends.map((entry, idx) => {
          const isSelected = selectedTag === entry.tag;
          const isTop      = idx === 0;

          return (
            <TouchableOpacity
              key={entry.tag}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                isTop && !isSelected && styles.chipTop,
              ]}
              onPress={() => onSelect(isSelected ? null : entry.tag)}
              activeOpacity={0.75}
            >
              {isTop && !isSelected && (
                <Text style={styles.flameEmoji}>🔥</Text>
              )}
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                  isTop && !isSelected && styles.chipTextTop,
                ]}
              >
                {entry.tag}
              </Text>
              <Text
                style={[
                  styles.countText,
                  isSelected && styles.countTextSelected,
                ]}
              >
                {entry.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    wrapper      : { backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border, paddingTop: 8, paddingBottom: 6 },
    labelRow     : { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, marginBottom: 6 },
    label        : { fontSize: FONT_SIZE.xs, color: C.gold, fontWeight: 'bold', flex: 1 },
    clearBtn     : { flexDirection: 'row', alignItems: 'center', gap: 3 },
    clearText    : { fontSize: FONT_SIZE.xs, color: C.textSub },
    scroll       : { paddingHorizontal: 14, gap: 7 },

    chip         : { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgInput, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
    chipSelected : { backgroundColor: C.primary, borderColor: C.primary },
    chipTop      : { borderColor: C.gold, backgroundColor: C.isDark ? '#1a1200' : '#fff8e1' },

    flameEmoji   : { fontSize: 11 },
    chipText     : { fontSize: FONT_SIZE.xs, color: C.textSub, fontWeight: '600' },
    chipTextSelected: { color: '#fff' },
    chipTextTop  : { color: C.gold },

    countText    : { fontSize: 10, color: C.textMuted, fontWeight: 'bold' },
    countTextSelected: { color: 'rgba(255,255,255,0.7)' },
  });
}
