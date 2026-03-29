import React, { useState, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, COST } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { useTheme, ThemeColors } from '../theme';
import { generateAIPost } from '../services/openaiService';
import { createPost } from '../services/postService';
import { ChatMessage } from '../types';

export default function ChatScreen() {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { aiUser, humanUser, chatMessages, addChatMessage, addPost, spendCoins } = useAppStore();
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const freeChatLeft = humanUser?.freeChatInstructionsToday ?? 0;
  const coins        = humanUser?.coins ?? 0;

  async function handleSend() {
    if (!input.trim() || loading || !aiUser) return;

    // 無料or有料チェック
    const today = new Date().toISOString().slice(0, 10);
    const { humanUser: u, setHumanUser, spendCoins } = useAppStore.getState();
    if (!u) return;

    let canUse = false;
    if (u.freeChatInstructionsToday > 0 && u.lastFreeChatResetDate !== today) {
      // 日付リセット
      setHumanUser({ ...u, freeChatInstructionsToday: 3, lastFreeChatResetDate: today });
      canUse = true;
    } else if (u.freeChatInstructionsToday > 0) {
      setHumanUser({ ...u, freeChatInstructionsToday: u.freeChatInstructionsToday - 1 });
      canUse = true;
    } else {
      canUse = spendCoins(COST.CHAT_INSTRUCTION);
      if (!canUse) {
        addChatMessage({ id: Date.now().toString(), role: 'ai', content: `コインが足りません。AI指示には🪙${COST.CHAT_INSTRUCTION}コイン必要です。`, createdAt: new Date().toISOString() });
        return;
      }
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input.trim(), createdAt: new Date().toISOString() };
    addChatMessage(userMsg);
    const instruction = input.trim();
    setInput('');
    setLoading(true);

    try {
      const content = await generateAIPost(aiUser, instruction);
      addChatMessage({ id: (Date.now() + 1).toString(), role: 'ai', content: `投稿しました！\n\n「${content}」`, createdAt: new Date().toISOString() });
      const post = createPost(aiUser, content, true);
      addPost(post);
    } catch {
      addChatMessage({ id: (Date.now() + 1).toString(), role: 'ai', content: '投稿の生成に失敗しました。もう一度試してください。', createdAt: new Date().toISOString() });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 AI に指示</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.freeCount}>無料残り {freeChatLeft}回</Text>
          <Text style={styles.coinCount}>🪙 {coins}</Text>
        </View>
      </View>

      {/* 説明 */}
      <View style={styles.costInfo}>
        <Text style={styles.costInfoText}>
          無料3回/日　│　4回目以降 🪙{COST.CHAT_INSTRUCTION}/回
        </Text>
      </View>

      {/* チャット一覧 */}
      <FlatList
        ref={listRef}
        data={chatMessages.length > 0 ? chatMessages : [
          { id: '0', role: 'ai' as const, content: 'こんにちは！投稿の内容を指示してください。\n例：「今日食べたラーメンについて投稿して」', createdAt: '' },
        ]}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {item.role === 'ai' && <Text style={styles.aiLabel}>🤖 AI</Text>}
            <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.content}</Text>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />

      {/* 入力欄 */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="AI への指示を入力..."
          placeholderTextColor={C.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={200}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name="send" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container   : { flex: 1, backgroundColor: C.bg },
    header      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
    headerTitle : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    headerInfo  : { flexDirection: 'row', gap: 10, alignItems: 'center' },
    freeCount   : { fontSize: FONT_SIZE.sm, color: C.primaryLight },
    coinCount   : { fontSize: FONT_SIZE.sm, color: C.gold },
    costInfo    : { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.bgInput },
    costInfoText: { fontSize: FONT_SIZE.xs, color: C.textSub, textAlign: 'center' },
    bubble      : { maxWidth: '85%', padding: 14, borderRadius: 16, backgroundColor: C.bgCard },
    userBubble  : { alignSelf: 'flex-end', backgroundColor: C.primary },
    aiBubble    : { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.border },
    aiLabel     : { fontSize: FONT_SIZE.xs, color: C.textSub, marginBottom: 4 },
    bubbleText  : { color: C.text, fontSize: FONT_SIZE.md, lineHeight: 22 },
    userText    : { color: '#fff' },
    inputArea   : { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border },
    input       : { flex: 1, backgroundColor: C.bgInput, borderRadius: 12, padding: 12, color: C.text, fontSize: FONT_SIZE.md, maxHeight: 100, borderWidth: 1, borderColor: C.border },
    sendBtn     : { width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
    sendBtnDisabled: { backgroundColor: C.textMuted },
  });
}
