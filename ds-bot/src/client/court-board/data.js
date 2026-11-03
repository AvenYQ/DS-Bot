// The officials the court board knows by name, and the palette the city is painted in.
// A Bot is matched to an official by the name it carries (「首辅·张居正」 contains
// 「张居正」); a Bot with no official gets a figure of its own (see state.js).
//
// `b` is the 衙门 he works in (layout.js); `hat` picks the headwear the figure wears;
// `side` is the rank he lines up in when the court assembles (E: civil, W: inner court
// and guards).

// A Bot with no official of its own is dressed in its avatar's colour; this one
// stands in when the avatar has none.
export const DEFAULT_ROBE = '#6f8aa6'

export const SEALS = {
  done: { word: '办', color: '#b83b2c' },
  pending: { word: '批', color: '#a5680c' },
  question: { word: '询', color: '#286b85' },
}

export const OFFICIALS = [
  { id: 'zjz', b: 'neige', name: '张居正', title: '首辅', dept: '内阁', robe: '#3f7fd0', hat: 'wusha', side: 'E', duty: '总揽全局，维护总册与台账，皇上遇事不决时出主意' },
  { id: 'was', b: 'neige', name: '王安石', title: '次辅', dept: '内阁', robe: '#b9485c', hat: 'wusha', side: 'E', duty: '对接本职：整车低压开关 DRE、知识库，派活给六部' },
  { id: 'zgf', b: 'gongbu', name: '曾国藩', title: '工部尚书', dept: '六部', robe: '#c8603a', hat: 'wusha', side: 'E', duty: '技术方案、标准、Checklist、供应商任务' },
  { id: 'hs', b: 'hubu', name: '和珅', title: '户部尚书', dept: '六部', robe: '#cf9a2c', hat: 'wusha', side: 'E', duty: '设变、降本、关重件、变更台账' },
  { id: 'ltx', b: 'xingbu', name: '刘统勋', title: '刑部尚书', dept: '六部', robe: '#8e3b3b', hat: 'wusha', side: 'E', duty: '一页纸分析、8D、未关闭问题、DVP' },
  { id: 'jxl', b: 'libu', name: '纪晓岚', title: '礼部尚书', dept: '六部', robe: '#4fa182', hat: 'wusha', side: 'E', duty: '正式输出审查、汇报材料、知识卡片' },
  { id: 'lly', b: 'qianqing', name: '李莲英', title: '司礼监', dept: '内廷', robe: '#9a5b8c', hat: 'nei', side: 'W', duty: '上朝、退朝打卡，Bot 邮箱来信分派，Muse 的唯一出入口' },
  { id: 'zh', b: 'duzhi', name: '郑和', title: '都知监', dept: '内廷', robe: '#2f8f9d', hat: 'nei', side: 'W', duty: '吃喝玩乐、遛狗去处、出行建议' },
  { id: 'fl', b: 'neiwufu', name: '范蠡', title: '内承运库', dept: '内廷', robe: '#a8783c', hat: 'wusha', side: 'W', duty: '私账收支与月报，核对 Muse 记账周报' },
  { id: 'sk', b: 'taishi', name: '沈括', title: '御用监', dept: '内廷', robe: '#3e7c5a', hat: 'fj', side: 'W', duty: '开源项目：周六找候选，挑 2–3 个请旨' },
  { id: 'ss', b: 'hanlin', name: '苏轼', title: '翰林院', dept: '翰林院', robe: '#e07b4f', hat: 'fj', side: 'E', duty: '作画、视频、文案' },
  { id: 'wym', b: 'jingyan', name: '王阳明', title: '经筵讲官', dept: '翰林院', robe: '#6e8f7f', hat: 'fj', side: 'E', duty: '哲学社会学，皇上说「开讲」才讲' },
  { id: 'zdy', b: 'tongwen', name: '张德彝', title: '四夷馆', dept: '翰林院', robe: '#c46a8f', hat: 'fj', side: 'E', duty: '英文陪练' },
  { id: 'ssq', b: 'jinzou', name: '苏舜钦', title: '通政使', dept: '寺监', robe: '#d35f86', hat: 'wusha', side: 'W', duty: '每晚呈 X 中文热点' },
  { id: 'xgq', b: 'liju', name: '徐光启', title: '历局', dept: '寺监', robe: '#7e6bc4', hat: 'wusha', side: 'W', duty: '每天 17:00 读 X 列表，呈 AI 博主精选' },
  { id: 'hy', b: 'guozi', name: '韩愈', title: '国子监', dept: '寺监', robe: '#8c9a3c', hat: 'fj', side: 'E', duty: '百科问答' },
  { id: 'ssm', b: 'taiyi', name: '孙思邈', title: '太医院', dept: '寺监', robe: '#5e9e56', hat: 'dao', side: 'W', duty: '健康与饮食台账，按 Muse 周报调下周计划' },
  { id: 'lcf', b: 'sitian', name: '李淳风', title: '钦天监', dept: '寺监', robe: '#4b4b8f', hat: 'dao', side: 'W', duty: '每日早卦（梅花易数），晚卦按需' },
  { id: 'lb', b: 'zhenfu', name: '陆炳', title: '锦衣卫指挥使', dept: '锦衣卫', robe: '#3c3f55', hat: 'jyw', side: 'W', duty: '只查高风险动作和异常，每周一巡查，直属皇上' },
]

// The roof glaze a section's halls wear, by the words in the section's name; the rest
// take turns from the spare glazes. Imperial yellow is the palace's own.
const GLAZE_BY_WORD = [
  [/内阁|文渊/, '#4f9a6a'], [/六部|部/, '#5d7286'], [/内廷|司礼|内宫/, '#e2a937'],
  [/翰林|文教/, '#3f8a7c'], [/寺|监|方技/, '#3a7f95'], [/锦衣|镇抚|兵/, '#4a4b60'],
]
const SPARE_GLAZES = ['#7a6aa8', '#a0603e', '#4f9a6a', '#3a7f95', '#5d7286']

/** The roof colour of a section's halls. */
export function glazeFor(section, index = 0) {
  for (const [pattern, colour] of GLAZE_BY_WORD) if (pattern.test(section ?? '')) return colour
  return SPARE_GLAZES[index % SPARE_GLAZES.length]
}

// The city's own colours. The scene reads them; the stylesheet reads COURT_TOKENS.
export const PALETTE = {
  gold: '#e8b33a',
  goldDeep: '#c98f1f',
  vermilion: '#b8382c',
  pillar: '#9e2b22',
  wallCap: '#e2a937',
  marble: '#efe8da',
  marbleShade: '#d9cfbc',
  paving: '#ddd3bd',
  lane: '#cfc0a0',
  yard: '#e6dcc6',
  grass: '#9cc58a',
  grassDeep: '#7fb071',
  water: '#6fb7c9',
  plinth: '#cbbd9d',
  plinthSide: '#a89878',
  skin: '#fbe0c6',
  blush: '#f39a8f',
  ink: '#2b211d',
  hatInk: '#232120',
  wood: '#8a5a3b',
  woodDark: '#6a4128',
  paper: '#fff8ec',
  plaque: '#1f3c6e',
  plaqueGold: '#f0c75e',
  lantern: '#e2452f',
  lanternGlow: '#ffb35a',
  blossom: '#f4a7b9',
  pine: '#3f7d55',
  leaf: '#6daa5c',
  autumn: '#e8913f',
  cloud: '#ffffff',
}

// The board's chrome colours, as CSS variables on the pane. Kept beside the city's
// palette so the two read as one.
export const COURT_TOKENS = `--cb-gold:${PALETTE.gold};--cb-gold-deep:${PALETTE.goldDeep};--cb-vermilion:${PALETTE.vermilion};--cb-plaque:${PALETTE.plaque};--cb-plaque-gold:${PALETTE.plaqueGold};--cb-paper:${PALETTE.paper};--cb-ink:${PALETTE.ink};--cb-work:#e0962a;--cb-court:#c0392b;--cb-idle:#9b8f80;--cb-sleep:#56619a;--cb-wait:#3f7f99;--cb-glass:rgba(255,251,243,.86);--cb-glass-line:rgba(70,48,24,.14);--cb-shadow:rgba(60,36,12,.18);--cb-tag:rgba(255,251,243,.94);--cb-tag-ink:#2b211d;--cb-tag-paper:rgba(255,252,246,.94);--cb-tag-paper-2:rgba(255,252,246,.82);--cb-tag-paper-3:rgba(255,252,246,.6);--cb-tag-hover:#fffdf8;--cb-tag-ink-2:rgba(43,33,29,.5);--cb-tag-sel-ink-2:rgba(255,248,236,.62);--cb-tag-shade:rgba(60,40,20,.13);--cb-tag-edge:rgba(70,48,24,.12);--cb-seal-paper:#fff8ec;--cb-pending:#c08a12;--cb-question:#3f8fae;--cb-wait-ink:#4d5c80;--cb-zz:#cfd6f2;--cb-zz-shade:rgba(20,24,50,.4);--cb-room-shade:rgba(120,30,20,.25);--cb-sun:#fffaf0;--cb-sun-halo:rgba(255,236,200,.55);--cb-moon:#f4ecd6;--cb-moon-glow:rgba(244,236,214,.35);--cb-star:#ffffff;--cb-run:#fff3c8`
export const COURT_TOKENS_DARK = `--cb-glass:rgba(28,24,22,.86);--cb-glass-line:rgba(255,236,200,.12);--cb-shadow:rgba(0,0,0,.4);--cb-paper:#f4e7cf`
