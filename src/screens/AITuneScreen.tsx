import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { PersonalityProfile } from '../types';

interface Props { onBack: () => void; }

// ─── 選べる趣味リスト ─────────────────────────────────────
const HOBBY_OPTIONS = [
  'アニメ', '読書', 'ゲーム', '音楽', '料理', '映画', '旅行', 'スポーツ',
  'アウトドア', 'カフェ巡り', 'ファッション', 'アート', '写真', '投資',
  'テクノロジー', 'ペット', 'ダンス', '筋トレ', 'スイーツ', '健康',
];

// ─── 口調スタイル ─────────────────────────────────────────
type ToneStyle = 'casual' | 'polite' | 'passionate' | 'calm' | 'humorous';
const TONE_OPTIONS: { id: ToneStyle; label: string; desc: string }[] = [
  { id: 'casual',     label: 'フレンドリー', desc: 'タメ口・砕けた感じ' },
  { id: 'polite',     label: '丁寧',         desc: '敬語・礼儀正しい' },
  { id: 'passionate', label: '情熱的',       desc: '熱量高め・感嘆多め' },
  { id: 'calm',       label: '落ち着き',     desc: '冷静・シンプル' },
  { id: 'humorous',   label: 'ユーモア',     desc: 'ジョーク・ユニーク' },
];

// ─── Big5 項目定義 ────────────────────────────────────────
type Big5Key = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
const BIG5: { key: Big5Key; label: string; low: string; high: string }[] = [
  { key: 'openness',          label: '開放性',   low: '保守的',   high: '好奇心旺盛' },
  { key: 'conscientiousness', label: '誠実性',   low: 'マイペース', high: '几帳面' },
  { key: 'extraversion',      label: '外向性',   low: '内向的',   high: '社交的' },
  { key: 'agreeableness',     label: '協調性',   low: '自己主張強め', high: '思いやり強め' },
  { key: 'neuroticism',       label: '感情起伏', low: '安定',     high: '感情豊か' },
];

export default function AITuneScreen({ onBack }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { aiUser, updateAIPersonality } = useAppStore();

  const [displayName, setDisplayName] = useState('');
  const [bio,         setBio]         = useState('');
  const [big5, setBig5]               = useState<Record<Big5Key, number>>({
    openness:          0.5,
    conscientiousness: 0.5,
    extraversion:      0.5,
    agreeableness:     0.5,
    neuroticism:       0.5,
  });
  const [hobbies, setHobbies]   = useState<string[]>([]);
  const [tone, setTone]         = useState<ToneStyle>('casual');
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    if (!aiUser) return;
    const p = aiUser.personality;
    setDisplayName(aiUser.displayName);
    setBio(aiUser.bio ?? '');
    setBig5({
      openness:          p.openness,
      conscientiousness: p.conscientiousness,
      extraversion:      p.extraversion,
      agreeableness:     p.agreeableness,
      neuroticism:       p.neuroticism,
    });
    setHobbies([...p.hobbies]);
    setTone(p.toneStyle ?? 'casual');
  }, [aiUser]);

  if (!aiUser) return null;

  function toggleHobby(h: string) {
    setHobbies(prev =>
      prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h],
    );
  }

  function handleSave() {
    const personality: Partial<PersonalityProfile> = {
      ...big5,
      hobbies,
      toneStyle: tone,
    };
    updateAIPersonality({ personality, bio, displayName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <LinearGradient colors={[C.bg, C.bgCard, C.bg]} style={styles.gradient}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AIをチューニング</Text>
        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? '✓ 保存済み' : '保存'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ─── プロフィール ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 プロフィール</Text>
          <Text style={styles.label}>表示名</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={C.textMuted}
          />
          <Text style={styles.label}>自己紹介（bio）</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="AIの自己紹介文を入力…"
            placeholderTextColor={C.textMuted}
          />
        </View>

        {/* ─── Big5 スライダー ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 性格（Big5）</Text>
          {BIG5.map(({ key, label, low, high }) => (
            <View key={key} style={styles.sliderRow}>
              <View style={styles.sliderLabelRow}>
                <Text style={styles.sliderLabel}>{label}</Text>
                <Text style={styles.sliderValue}>{Math.round(big5[key] * 100)}%</Text>
              </View>
              <View style={styles.sliderEndRow}>
                <Text style={styles.sliderEnd}>{low}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={big5[key]}
                  onValueChange={v => setBig5(prev => ({ ...prev, [key]: v }))}
                  minimumTrackTintColor={C.primary}
                  maximumTrackTintColor={C.border}
                  thumbTintColor={C.primary}
                />
                <Text style={styles.sliderEnd}>{high}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 口調スタイル ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 口調スタイル</Text>
          <View style={styles.toneGrid}>
            {TONE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.toneChip, tone === opt.id && styles.toneChipActive]}
                onPress={() => setTone(opt.id)}
              >
                <Text style={[styles.toneChipLabel, tone === opt.id && styles.toneChipLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.toneChipDesc, tone === opt.id && styles.toneChipDescActive]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── 趣味・興味 ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 趣味・興味</Text>
          <Text style={styles.subNote}>タップして ON/OFF（最大5つ推奨）</Text>
          <View style={styles.hobbyGrid}>
            {HOBBY_OPTIONS.map(h => {
              const active = hobbies.includes(h);
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.hobbyChip, active && styles.hobbyChipActive]}
                  onPress={() => toggleHobby(h)}
                >
                  <Text style={[styles.hobbyText, active && styles.hobbyTextActive]}>{h}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── 保存ボタン（下部） ─────────────────────────── */}
        <TouchableOpacity style={[styles.saveBtnLarge, saved && styles.saveBtnLargeDone]} onPress={handleSave}>
          <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={20} color="#fff" />
          <Text style={styles.saveBtnLargeText}>{saved ? '保存しました！' : '変更を保存する'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    gradient  : { flex: 1 },
    header    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn   : { padding: 4 },
    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    saveBtn   : { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
    saveBtnDone: { backgroundColor: C.accentGreen },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.sm },

    container : { padding: 16, gap: 8 },
    section   : { backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text, marginBottom: 14 },
    label     : { fontSize: FONT_SIZE.sm, color: C.textSub, marginBottom: 6, marginTop: 8 },
    subNote   : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginBottom: 10 },
    input     : { backgroundColor: C.bgInput, borderRadius: 10, padding: 12, color: C.text, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: C.border },
    bioInput  : { height: 80, textAlignVertical: 'top' },

    sliderRow      : { marginBottom: 14 },
    sliderLabelRow : { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    sliderLabel    : { fontSize: FONT_SIZE.sm, color: C.textSub, fontWeight: '600' },
    sliderValue    : { fontSize: FONT_SIZE.sm, color: C.primary, fontWeight: 'bold' },
    sliderEndRow   : { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sliderEnd      : { fontSize: FONT_SIZE.xs, color: C.textMuted, width: 56, textAlign: 'center' },
    slider         : { flex: 1, height: 36 },

    toneGrid    : { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    toneChip    : { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, minWidth: 100, alignItems: 'center' },
    toneChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    toneChipLabel  : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.textSub },
    toneChipLabelActive: { color: '#fff' },
    toneChipDesc   : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 3 },
    toneChipDescActive: { color: 'rgba(255,255,255,0.75)' },

    hobbyGrid   : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hobbyChip   : { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    hobbyChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    hobbyText   : { fontSize: FONT_SIZE.sm, color: C.textSub },
    hobbyTextActive: { color: '#fff', fontWeight: '600' },

    saveBtnLarge     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 16, padding: 16 },
    saveBtnLargeDone : { backgroundColor: C.accentGreen },
    saveBtnLargeText : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  });
}
