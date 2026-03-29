import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { QUIZ_QUESTIONS, buildPersonalityFromAnswers } from '../services/personalityService';
import { generateAvatarUrl } from '../services/avatarService';
import { diceBearUrl } from '../services/iconService';
import { generateAIPost } from '../services/openaiService';
import { createPost } from '../services/postService';
import { useAppStore } from '../store/useAppStore';
import { AIUserData, QuizAnswers } from '../types';

interface Props { onComplete: () => void; }

type LoadingStep = 'avatar' | 'firstPost';

export default function QuizScreen({ onComplete }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]        = useState<QuizAnswers>({});
  const [generating, setGenerating]  = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('avatar');
  const { humanUser, setAIUser, setHumanUser, addPost } = useAppStore();

  const q       = QUIZ_QUESTIONS[currentIdx];
  const isMulti = q.type === 'multiple';
  const selected = answers[q.id];

  function isOptionSelected(i: number): boolean {
    if (isMulti) return Array.isArray(selected) && (selected as number[]).includes(i);
    return selected === i;
  }

  function toggleOption(i: number) {
    if (isMulti) {
      const prev = (Array.isArray(selected) ? selected : []) as number[];
      const next = prev.includes(i)
        ? prev.filter(x => x !== i)
        : prev.length < (q.maxSelections ?? 5) ? [...prev, i] : prev;
      setAnswers({ ...answers, [q.id]: next });
    } else {
      setAnswers({ ...answers, [q.id]: i });
    }
  }

  function handleNext() {
    if (currentIdx < QUIZ_QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      finishQuiz();
    }
  }

  function handlePrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  async function finishQuiz() {
    if (!humanUser) return;
    setGenerating(true);
    setLoadingStep('avatar');

    const profile = buildPersonalityFromAnswers(answers);
    const aiUser: AIUserData = {
      userId             : 'ai_' + humanUser.userId,
      username           : 'ai_' + humanUser.username,
      displayName        : humanUser.displayName + ' (AI)',
      email              : '',
      iconBase64         : '',
      followersCount     : 0,
      followingCount     : 0,
      postCount          : 0,
      createdAt          : new Date().toISOString(),
      isAI               : true,
      coins              : 0,
      freeIconRegenRemaining    : 3,
      freeChatInstructionsToday : 3,
      lastFreeChatResetDate     : '',
      followingIds       : [],
      likedPostIds       : [],
      repostIds          : [],
      personality        : profile,
      linkedHumanUserId  : humanUser.userId,
      humanPostButtonsRemaining : 10,
      lastPostButtonResetDate   : '',
      totalPostsMade     : 0,
    };

    // Step 1: アバター生成
    try {
      const url = await generateAvatarUrl(profile, aiUser.displayName);
      aiUser.iconBase64 = url ?? diceBearUrl(aiUser.username);
    } catch {
      aiUser.iconBase64 = diceBearUrl(aiUser.username);
    }

    setAIUser(aiUser);
    setHumanUser({ ...humanUser, iconBase64: aiUser.iconBase64 });

    // Step 2: 最初の投稿を即時生成
    setLoadingStep('firstPost');
    try {
      const firstContent = await generateAIPost(
        aiUser,
        'はじめての投稿。自己紹介と最近気になっていることを自然な感じで書いて'
      );
      const firstPost = createPost(aiUser, firstContent, true);
      addPost(firstPost);
    } catch { /* 最初の投稿生成失敗は無視 */ }

    setGenerating(false);
    onComplete();
  }

  // ─── ローディング画面 ─────────────────────────────────
  if (generating) {
    return (
      <LinearGradient colors={['#0a0a1a', '#130026']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />

        {loadingStep === 'avatar' ? (
          <>
            <Text style={styles.loadingText}>AIアバターを生成中...✨</Text>
            <Text style={styles.loadingSubText}>あなたの性格に合ったアバターを作っています</Text>
          </>
        ) : (
          <>
            <Text style={styles.loadingText}>はじめての投稿を準備中...📝</Text>
            <Text style={styles.loadingSubText}>あなたのAIが最初のつぶやきを考えています</Text>
          </>
        )}

        <View style={styles.stepIndicator}>
          <StepDot active={true}  done={loadingStep === 'firstPost'} label="アバター" C={C} />
          <View style={styles.stepLine} />
          <StepDot active={loadingStep === 'firstPost'} done={false} label="初投稿" C={C} />
        </View>
      </LinearGradient>
    );
  }

  const progress = (currentIdx + 1) / QUIZ_QUESTIONS.length;

  return (
    <LinearGradient colors={['#0a0a1a', '#13001a']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* プログレスバー */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{currentIdx + 1} / {QUIZ_QUESTIONS.length}</Text>

        {/* 質問 */}
        <Text style={styles.question}>{q.questionText}</Text>
        {isMulti && <Text style={styles.multiHint}>複数選択可（最大{q.maxSelections}つ）</Text>}

        {/* 選択肢 */}
        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const sel = isOptionSelected(i);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, sel && styles.optionSelected]}
                onPress={() => toggleOption(i)}
              >
                <View style={[styles.optionDot, sel && styles.optionDotSelected]}>
                  {sel && <View style={styles.optionDotInner} />}
                </View>
                <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ナビゲーション */}
        <View style={styles.nav}>
          <TouchableOpacity
            style={[styles.navBtn, currentIdx === 0 && styles.navBtnDisabled]}
            onPress={handlePrev}
            disabled={currentIdx === 0}
          >
            <Text style={styles.navBtnText}>← 前へ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navBtnPrimary} onPress={handleNext}>
            <Text style={styles.navBtnPrimaryText}>
              {currentIdx === QUIZ_QUESTIONS.length - 1 ? '完了 ✨' : '次へ →'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

function StepDot({ active, done, label, C }: { active: boolean; done: boolean; label: string; C: ThemeColors }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[
        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bgInput, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
        active && { borderColor: C.primary, backgroundColor: C.isDark ? '#2a1060' : '#ede8ff' },
        done && { backgroundColor: C.primary, borderColor: C.primary },
      ]}>
        {done && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
      </View>
      <Text style={[{ fontSize: FONT_SIZE.xs, color: C.textMuted }, active && { color: C.primary }]}>{label}</Text>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container       : { flexGrow: 1, padding: 24, paddingTop: 60 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
    loadingText     : { fontSize: FONT_SIZE.xl, color: C.text, fontWeight: 'bold', textAlign: 'center' },
    loadingSubText  : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center' },
    stepIndicator   : { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 0 },
    stepLine        : { width: 48, height: 2, backgroundColor: C.border, marginHorizontal: 8 },
    progressBg      : { height: 6, backgroundColor: C.bgInput, borderRadius: 3, overflow: 'hidden' },
    progressFill    : { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
    progressText    : { color: C.textSub, fontSize: FONT_SIZE.xs, textAlign: 'right', marginTop: 4, marginBottom: 32 },
    question        : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: C.text, lineHeight: 30, marginBottom: 8 },
    multiHint       : { fontSize: FONT_SIZE.xs, color: C.textSub, marginBottom: 16 },
    options         : { gap: 10, marginBottom: 40 },
    option          : { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
    optionSelected  : { borderColor: C.primary, backgroundColor: C.isDark ? '#1a1030' : '#f0eaff' },
    optionDot       : { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.textMuted, justifyContent: 'center', alignItems: 'center' },
    optionDotSelected: { borderColor: C.primary },
    optionDotInner  : { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
    optionText      : { flex: 1, color: C.textSub, fontSize: FONT_SIZE.md },
    optionTextSelected: { color: C.text, fontWeight: '600' },
    nav             : { flexDirection: 'row', gap: 12 },
    navBtn          : { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
    navBtnDisabled  : { opacity: 0.3 },
    navBtnText      : { color: C.textSub, fontSize: FONT_SIZE.md },
    navBtnPrimary   : { flex: 2, backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
    navBtnPrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  });
}
