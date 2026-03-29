import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { FONT_SIZE, STAMINA } from '../constants';
import { useTheme, ThemeColors } from '../theme';

export default function StaminaBar() {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { stamina, aiUser } = useAppStore();

  const postLeft = aiUser?.humanPostButtonsRemaining ?? 0;
  const likeLeft = STAMINA.MAX_LIKES    - stamina.likesUsed;
  const rpLeft   = STAMINA.MAX_REPOSTS  - stamina.repostsUsed;

  return (
    <View style={styles.container}>
      <Item icon="flash"  color={C.primary} value={postLeft} max={STAMINA.MAX_POST_BUTTONS} label="ポスト" bgStyle={styles.barBg} itemStyle={styles.item} labelStyle={styles.label} />
      <Item icon="heart"  color={C.like}    value={likeLeft} max={STAMINA.MAX_LIKES}        label="いいね" bgStyle={styles.barBg} itemStyle={styles.item} labelStyle={styles.label} />
      <Item icon="repeat" color={C.repost}  value={rpLeft}   max={STAMINA.MAX_REPOSTS}      label="RT"     bgStyle={styles.barBg} itemStyle={styles.item} labelStyle={styles.label} />
    </View>
  );
}

function Item({ icon, color, value, max, label, bgStyle, itemStyle, labelStyle }: {
  icon: string; color: string; value: number; max: number; label: string;
  bgStyle: any; itemStyle: any; labelStyle: any;
}) {
  const pct = value / max;
  return (
    <View style={itemStyle}>
      <Ionicons name={icon as any} size={12} color={color} />
      <View style={bgStyle}>
        <View style={{ height: '100%', borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: color }} />
      </View>
      <Text style={[labelStyle, { color }]}>{value}</Text>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container : { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
    item      : { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    barBg     : { flex: 1, height: 4, backgroundColor: C.bgInput, borderRadius: 2, overflow: 'hidden' },
    label     : { fontSize: FONT_SIZE.xs, fontWeight: 'bold', minWidth: 16, textAlign: 'right' },
  });
}
