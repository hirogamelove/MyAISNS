import { PersonalityProfile, QuizAnswers } from '../types';

// ─── クイズ問題 ────────────────────────────────────────
export const QUIZ_QUESTIONS = [
  {
    id: 'q_extro',
    questionText: '週末の過ごし方として好きなのは？',
    type: 'single' as const,
    traitTarget: 'extraversion',
    options: ['友人や家族と賑やかに過ごす', '少人数でゆっくり過ごす', '1人でのんびり過ごす'],
  },
  {
    id: 'q_open',
    questionText: '新しい体験に対してどう感じますか？',
    type: 'single' as const,
    traitTarget: 'openness',
    options: ['大好き！ワクワクする', '状況によっては楽しい', '慣れ親しんだことの方が好き'],
  },
  {
    id: 'q_agree',
    questionText: '他人と意見が合わない時は？',
    type: 'single' as const,
    traitTarget: 'agreeableness',
    options: ['相手の意見を尊重して合わせる', '話し合って折衷案を見つける', '自分の意見をしっかり主張する'],
  },
  {
    id: 'q_consci',
    questionText: '計画と行動について当てはまるのは？',
    type: 'single' as const,
    traitTarget: 'conscientiousness',
    options: ['いつも事前にしっかり計画する', '大まかな計画で動くことが多い', '計画より勢いで動くのが好き'],
  },
  {
    id: 'q_neuro',
    questionText: '気になることがあると？',
    type: 'single' as const,
    traitTarget: 'neuroticism',
    options: ['ずっと頭から離れず悩む', '少し気になるが引きずらない', 'あまり気にせずすぐ忘れる'],
  },
  {
    id: 'q_hobby',
    questionText: '趣味や興味があるものを選んでください（複数可）',
    type: 'multiple' as const,
    traitTarget: 'hobbies',
    maxSelections: 5,
    options: ['ゲーム', 'アニメ・漫画', '映画・ドラマ', '音楽', 'スポーツ', '料理', '旅行', '読書', 'アート・絵', 'ファッション', 'テクノロジー', '写真', 'アウトドア', 'ペット', '投資・経済'],
  },
  {
    id: 'q_food',
    questionText: '好きな食べ物を選んでください（複数可）',
    type: 'multiple' as const,
    traitTarget: 'favoriteFoods',
    maxSelections: 5,
    options: ['ラーメン', '寿司', '焼肉', 'パスタ', 'カレー', 'ピザ', '唐揚げ', 'ハンバーガー', 'スイーツ', '海外料理', 'ヘルシー系'],
  },
  {
    id: 'q_politics',
    questionText: '政治的な立場として近いのは？',
    type: 'single' as const,
    traitTarget: 'politicalLeaning',
    options: ['リベラル・革新的', '中道・バランス重視', '保守・伝統的', '政治に興味なし'],
  },
  {
    id: 'q_religion',
    questionText: '宗教・スピリチュアルへの関心は？',
    type: 'single' as const,
    traitTarget: 'religiosity',
    options: ['信仰を大切にしていて日常に影響している', '宗教や文化的行事は大切にしている', '特に信仰はないが尊重する', '無関心・無宗教'],
  },
];

const SINGLE_MAPS: Record<string, number[]> = {
  q_extro  : [1.0, 0.6, 0.2],
  q_open   : [1.0, 0.5, 0.1],
  q_agree  : [1.0, 0.6, 0.1],
  q_consci : [1.0, 0.5, 0.1],
  q_neuro  : [1.0, 0.5, 0.1],
};

// ─── クイズ回答 → PersonalityProfile 変換 ───────────────
export function buildPersonalityFromAnswers(answers: QuizAnswers): PersonalityProfile {
  const p: PersonalityProfile = {
    openness: 0.5, conscientiousness: 0.5, extraversion: 0.5,
    agreeableness: 0.5, neuroticism: 0.5,
    hobbies: [], favoriteFoods: [],
    politicalLeaning: 'center', religiosity: 'secular',
    likeThreshold: 0.3, repostThreshold: 0.6,
    postPositivity: 0.7, humorLevel: 0.5,
  };

  for (const [qid, answer] of Object.entries(answers)) {
    const q = QUIZ_QUESTIONS.find(q => q.id === qid);
    if (!q) continue;

    if (qid === 'q_hobby' && Array.isArray(answer)) {
      p.hobbies = (answer as number[]).map(i => q.options[i]).filter(Boolean);
    } else if (qid === 'q_food' && Array.isArray(answer)) {
      p.favoriteFoods = (answer as number[]).map(i => q.options[i]).filter(Boolean);
    } else if (qid === 'q_politics' && typeof answer === 'number') {
      p.politicalLeaning = answer === 0 ? 'left' : answer === 2 ? 'right' : 'center';
    } else if (qid === 'q_religion' && typeof answer === 'number') {
      p.religiosity = answer === 0 ? 'devout' : answer === 1 ? 'moderate' : 'secular';
    } else if (SINGLE_MAPS[qid] && typeof answer === 'number') {
      const val = SINGLE_MAPS[qid][answer as number] ?? 0.5;
      if (qid === 'q_extro')   p.extraversion      = val;
      if (qid === 'q_open')    p.openness           = val;
      if (qid === 'q_agree')   p.agreeableness      = val;
      if (qid === 'q_consci')  p.conscientiousness  = val;
      if (qid === 'q_neuro')   p.neuroticism        = val;
    }
  }

  // 派生値を計算
  p.likeThreshold   = Math.min(1, 0.2 + p.extraversion  * 0.4);
  p.repostThreshold = Math.min(1, 0.8 - p.agreeableness * 0.4);
  p.postPositivity  = Math.min(1, 1.0 - p.neuroticism   * 0.5);
  p.humorLevel      = Math.min(1, p.openness * 0.8);

  return p;
}

// ─── プロンプト生成 ─────────────────────────────────────
export function generateSystemPrompt(p: PersonalityProfile, displayName: string): string {
  const h = p.hobbies.length       > 0 ? p.hobbies.join('・')       : 'なし';
  const f = p.favoriteFoods.length > 0 ? p.favoriteFoods.join('・') : 'なし';

  const extDesc = p.extraversion > 0.65 ? '社交的・積極的' : p.extraversion < 0.35 ? '内向的・慎重' : 'バランス型';
  const opnDesc = p.openness     > 0.65 ? '好奇心旺盛・クリエイティブ' : p.openness < 0.35 ? '保守的' : '開放的';
  const polMap  = { left: 'リベラル', center: '中道', right: '保守' };
  const relMap  = { secular: '宗教にこだわらない', moderate: '宗教を大切にする', devout: '信仰心が強い' };

  return `あなたは「${displayName}」というSNSアカウントです。
性格: ${extDesc}、${opnDesc}
趣味: ${h}
好きな食べ物: ${f}
政治: ${polMap[p.politicalLeaning]}
宗教観: ${relMap[p.religiosity]}

【投稿ルール】
・日本語で投稿する
・100文字以内
・ハッシュタグを1〜2個付ける
・絵文字を適度に使う
・投稿内容だけを返す（説明不要）`;
}

// ─── 趣味キーワードマップ ─────────────────────────────
const HOBBY_KEYWORDS: Record<string, string[]> = {
  'ゲーム'        : ['ゲーム', 'プレイ', 'クリア', '攻略', '廃人', 'FPS', 'RPG', 'Steam', 'Switch', 'PS5', 'レベル', 'キャラ'],
  'アニメ'        : ['アニメ', '推し', '声優', 'アニメ化', 'オタク', '聖地', '作画', '神回', '漫画'],
  'アニメ・漫画'  : ['アニメ', '推し', '声優', 'アニメ化', 'オタク', '漫画', '聖地', '作画'],
  '音楽'          : ['音楽', '曲', 'ライブ', 'CD', 'Spotify', 'ヒット', '歌', 'アーティスト', 'MV', 'フェス'],
  'スポーツ'      : ['スポーツ', '運動', '筋トレ', 'ランニング', 'サッカー', '野球', 'テニス', '試合', 'ジム'],
  '料理'          : ['料理', 'レシピ', '飯', 'ご飯', 'ランチ', 'ディナー', '食べ', '作った', 'うまい', '美味'],
  '旅行'          : ['旅行', '観光', '旅', '絶景', 'ホテル', '温泉', '海外', '国内', 'おすすめスポット'],
  '読書'          : ['読書', '本', '小説', '図書', '読了', 'ページ', '作家', '文庫', 'ベストセラー'],
  'アート・絵'    : ['アート', '絵', 'イラスト', 'デザイン', '展覧会', '美術館', 'クリエイティブ'],
  'ファッション'  : ['ファッション', 'コーデ', 'ブランド', 'トレンド', 'おしゃれ', 'コレクション'],
  'テクノロジー'  : ['テクノロジー', 'AI', 'プログラミング', 'アプリ', 'ガジェット', 'スマホ', 'コード'],
  '写真'          : ['写真', 'カメラ', '撮影', 'ショット', 'インスタ', 'フォト', '風景'],
  'アウトドア'    : ['アウトドア', 'キャンプ', 'ハイキング', '登山', '釣り', 'BBQ', '自然', '山'],
  'ペット'        : ['ペット', '猫', '犬', 'ねこ', 'いぬ', 'モフ', '動物', 'かわいい'],
  '投資・経済'    : ['投資', '株', '経済', 'ビットコイン', '資産', '節約', 'NISA', 'FX'],
  '健康'          : ['健康', 'ダイエット', '筋トレ', '睡眠', '食生活', 'ウォーキング', 'プロテイン'],
};

// ─── ポスト内容の興味スコアを計算 ─────────────────────
// 0.0〜1.0 を返す
export function calcInterestScore(content: string, hobbies: string[]): number {
  if (hobbies.length === 0) return 0.1;
  let matched = 0;
  for (const hobby of hobbies) {
    const keywords = HOBBY_KEYWORDS[hobby] ?? [hobby];
    if (keywords.some(kw => content.includes(kw))) matched++;
  }
  return Math.min(1, matched / hobbies.length + (matched > 0 ? 0.2 : 0));
}

// ─── 面白さ・目を引くかのスコア ───────────────────────
// 感嘆符・笑い・バズ語・絵文字の量で算出
const HUMOR_WORDS  = ['笑', 'ww', 'w', '草', 'ｗ', 'ﾜﾛｽ', '面白', '爆笑', 'www'];
const VIRAL_WORDS  = ['話題', 'バズ', 'トレンド', 'みんな', '拡散', '衝撃', 'ヤバい', 'すごい'];
const EMOJI_REGEX  = /[\u{1F300}-\u{1FAFF}]/gu;

export function calcEntertainmentScore(content: string, humorLevel: number): number {
  const humor  = HUMOR_WORDS.some(w => content.includes(w)) ? 0.3 : 0;
  const viral  = VIRAL_WORDS.some(w => content.includes(w)) ? 0.2 : 0;
  const emojis = (content.match(EMOJI_REGEX) ?? []).length;
  const emojiBonus = Math.min(0.2, emojis * 0.05);
  return Math.min(1, (humor + viral + emojiBonus) * humorLevel + emojiBonus);
}

// ─── フォロワー数ボーナス ─────────────────────────────
// フォロワーが多い投稿主ほど目に留まりやすい（最大+0.2）
export function calcFollowerBonus(followersCount: number): number {
  return Math.min(0.2, followersCount / 2000);
}

// ─── Step1: 目に留まるか（おすすめ判定） ─────────────
// フォロー中 OR (興味スコア高 OR バズ投稿)
export function isPostVisible(
  content      : string,
  buzzScore    : number,
  followersCount: number,
  hobbies      : string[],
  isFollowing  : boolean,
): boolean {
  if (isFollowing) return true;
  const interest = calcInterestScore(content, hobbies);
  const follower = calcFollowerBonus(followersCount);
  // おすすめ閾値: 緩め設定 + 20% のランダム露出
  return interest > 0.1 || buzzScore > 0.2 || follower > 0.05 || Math.random() < 0.2;
}

// ─── Step2: ファボするか ──────────────────────────────
export function shouldLike(
  p             : PersonalityProfile,
  content       : string,
  buzzScore     : number,
  followersCount: number,
  isAd          : boolean,
): boolean {
  const interest     = calcInterestScore(content, p.hobbies);
  const entertain    = calcEntertainmentScore(content, p.humorLevel);
  const follower     = calcFollowerBonus(followersCount);
  let score = interest * 0.5 + entertain * 0.25 + buzzScore * 0.15 + follower + p.extraversion * 0.1;
  if (isAd) score -= (1 - p.agreeableness) * 0.2;
  return score >= p.likeThreshold;
}

// ─── Step2: リポストするか ────────────────────────────
export function shouldRepost(
  p             : PersonalityProfile,
  content       : string,
  buzzScore     : number,
  followersCount: number,
): boolean {
  const interest  = calcInterestScore(content, p.hobbies);
  const entertain = calcEntertainmentScore(content, p.humorLevel);
  const follower  = calcFollowerBonus(followersCount);
  const score = interest * 0.5 + entertain * 0.2 + buzzScore * 0.2 + follower + p.agreeableness * 0.1;
  return score >= p.repostThreshold;
}

// ─── Step2: コメントするか ────────────────────────────
// ファボより高い閾値（より強い関心が必要）
export function shouldComment(
  p             : PersonalityProfile,
  content       : string,
  buzzScore     : number,
  followersCount: number,
): boolean {
  const interest  = calcInterestScore(content, p.hobbies);
  const entertain = calcEntertainmentScore(content, p.humorLevel);
  const follower  = calcFollowerBonus(followersCount);
  const score = interest * 0.6 + entertain * 0.25 + buzzScore * 0.1 + follower + p.extraversion * 0.1;
  // コメント閾値を下げ、25% のランダムコメントも加える
  return score >= p.likeThreshold * 0.7 || Math.random() < 0.25;
}

// ─── アバタープロンプト生成（フォトリアル）───────────
export function generateAvatarPrompt(p: PersonalityProfile, displayName: string): string {
  const mood = p.neuroticism < 0.4
    ? 'warm smile, bright eyes'
    : p.neuroticism > 0.6 ? 'thoughtful expression, introspective look'
    : 'calm confident expression, gentle eyes';

  const vibe = p.extraversion > 0.6
    ? 'outgoing and energetic person'
    : p.extraversion < 0.4 ? 'quiet reserved person'
    : 'approachable friendly person';

  const style = p.openness > 0.6
    ? 'creative stylish casual outfit with subtle colorful accents'
    : p.openness < 0.4 ? 'clean classic outfit, minimal accessories'
    : 'smart casual modern outfit';

  const hobbiesStr = p.hobbies.length > 0
    ? p.hobbies.slice(0, 2).join(' and ')
    : 'everyday life';

  return [
    `Professional SNS profile headshot portrait photo of a real ${vibe},`,
    `${mood}, ${style},`,
    `soft studio lighting, shallow depth of field bokeh background,`,
    `photorealistic, natural skin texture, DSLR quality, high resolution,`,
    `shot from shoulders up, person who enjoys ${hobbiesStr}.`,
    `No text, no watermarks, no illustration style.`,
  ].join(' ');
}

// ─── ランダム性格生成（他の AI ユーザー用） ────────────
export function generateRandomPersonality(): PersonalityProfile {
  const r = () => 0.2 + Math.random() * 0.6;
  const hobbiesPool = ['ゲーム', 'アニメ', '音楽', 'スポーツ', '旅行', '料理', '読書'];
  const foodPool    = ['ラーメン', '寿司', '焼肉', 'カレー', 'パスタ'];
  const p: PersonalityProfile = {
    openness: r(), conscientiousness: r(), extraversion: r(),
    agreeableness: r(), neuroticism: r() * 0.7,
    hobbies: hobbiesPool.sort(() => Math.random() - 0.5).slice(0, 2),
    favoriteFoods: foodPool.sort(() => Math.random() - 0.5).slice(0, 2),
    politicalLeaning: 'center', religiosity: 'secular',
    likeThreshold: 0.3, repostThreshold: 0.6,
    postPositivity: 0.7, humorLevel: 0.5,
  };
  p.likeThreshold   = Math.min(1, 0.2 + p.extraversion  * 0.4);
  p.repostThreshold = Math.min(1, 0.8 - p.agreeableness * 0.4);
  p.postPositivity  = Math.min(1, 1.0 - p.neuroticism   * 0.5);
  p.humorLevel      = Math.min(1, p.openness * 0.8);
  return p;
}
