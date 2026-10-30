// The officials the court board knows by name, and where each one's 值房 stands in the
// city. The table is the 3D scene's own: a Bot is matched to an official by the name it
// carries (「首辅·张居正」 contains 「张居正」), so renaming an official here renames him
// everywhere. A Bot with no official gets a figure of its own (see state.js).
//
// `b` names a building in the scene's table; `off` shifts the figure sideways inside that
// building's yard; `side` is the court rank he lines up in for 宣早朝.

// A Bot with no official of its own is dressed in its avatar's colour; this one
// stands in when the avatar has none.
export const DEFAULT_ROBE = '#6f8aa6'

export const OFFICIALS = [
  { id: 'zjz', name: '张居正', title: '首辅', dept: '内阁', b: 'neige', off: -2, robe: '#3f7fd0', hat: 'wusha', side: 'E', duty: '总揽全局，维护总册与台账，皇上遇事不决时出主意' },
  { id: 'was', name: '王安石', title: '次辅', dept: '内阁', b: 'neige', off: 2, robe: '#b9485c', hat: 'wusha', side: 'E', duty: '对接本职：整车低压开关 DRE、知识库，派活给六部' },
  { id: 'zgf', name: '曾国藩', title: '工部左侍郎', dept: '六部', b: 'gongbu', robe: '#c8603a', hat: 'wusha', side: 'E', duty: '技术方案、标准、Checklist、供应商任务' },
  { id: 'hs', name: '和珅', title: '户部尚书', dept: '六部', b: 'hubu', robe: '#cf9a2c', hat: 'wusha', side: 'E', duty: '设变、降本、关重件、变更台账' },
  { id: 'ltx', name: '刘统勋', title: '刑部尚书', dept: '六部', b: 'xingbu', robe: '#8e3b3b', hat: 'wusha', side: 'E', duty: '一页纸分析、8D、未关闭问题、DVP' },
  { id: 'jxl', name: '纪晓岚', title: '礼部尚书', dept: '六部', b: 'libu', robe: '#4fa182', hat: 'wusha', side: 'E', duty: '正式输出审查、汇报材料、知识卡片' },
  { id: 'lb', name: '陆炳', title: '锦衣卫', dept: '北镇抚司', b: 'zhenfu', robe: '#3c3f55', hat: 'jyw', side: 'W', duty: '只查高风险动作和异常，周一、四巡查，直属皇上' },
  { id: 'lly', name: '李莲英', title: '总管', dept: '内廷', b: 'qianqing', off: -5, robe: '#9a5b8c', hat: 'nei', side: 'W', duty: '上朝、退朝打卡，共用邮箱来信分派' },
  { id: 'zh', name: '郑和', title: '都知监', dept: '内廷', b: 'duzhi', robe: '#2f8f9d', hat: 'nei', side: 'W', duty: '出行与生活：吃喝玩乐、遛狗去处、火车票' },
  { id: 'fl', name: '范蠡', title: '内务府', dept: '内廷', b: 'neiwufu', robe: '#a8783c', hat: 'wusha', side: 'W', duty: '私账收支与月报，火车票记账，DeepSeek 额度日查' },
  { id: 'ssq', name: '苏舜钦', title: '进奏院', dept: '通政', b: 'jinzou', robe: '#d35f86', hat: 'wusha', side: 'W', duty: '早报、晚报（含新梗）、76人赛后快报、急报' },
  { id: 'xgq', name: '徐光启', title: '历局', dept: '通政', b: 'liju', robe: '#7e6bc4', hat: 'wusha', side: 'W', duty: '每天 18:00 AI 日报' },
  { id: 'sk', name: '沈括', title: '司天监', dept: '通政', b: 'sitian', robe: '#3e7c5a', hat: 'wusha', side: 'W', duty: '开源项目：周六 09:00 找候选，挑 2–3 个请旨' },
  { id: 'ss', name: '苏轼', title: '翰林院', dept: '文教', b: 'hanlin', robe: '#e07b4f', hat: 'fj', side: 'E', duty: '作画、视频、文案' },
  { id: 'hy', name: '韩愈', title: '国子监', dept: '文教', b: 'guozi', robe: '#8c9a3c', hat: 'fj', side: 'E', duty: '百科问答' },
  { id: 'wym', name: '王阳明', title: '经筵', dept: '文教', b: 'jingyan', robe: '#6e8f7f', hat: 'fj', side: 'E', duty: '哲学社会学，皇上说「开讲」才讲' },
  { id: 'zdy', name: '张德彝', title: '同文馆', dept: '文教', b: 'tongwen', robe: '#c46a8f', hat: 'fj', side: 'E', duty: '英文陪练' },
  { id: 'ssm', name: '孙思邈', title: '太医院', dept: '方技', b: 'taiyi', robe: '#5e9e56', hat: 'dao', side: 'W', duty: '健康：每天早上今日要做的事，晚上同步健康与饮食台账' },
  { id: 'lcf', name: '李淳风', title: '太史局', dept: '方技', b: 'taishi', robe: '#4b4b8f', hat: 'dao', side: 'W', duty: '每日早卦（梅花易数），晚卦按需' },
]

// A Bot the table does not know still needs a 值房: the words in its name and role pick
// one, then the sidebar group it sits in. Nothing matches, and it lodges 编外.
const BY_WORD = [
  [/工部/, 'gongbu'], [/户部/, 'hubu'], [/刑部/, 'xingbu'], [/礼部/, 'libu'], [/兵部/, 'zhenfu'], [/吏部/, 'libu'],
  [/内阁|首辅|次辅|大学士/, 'neige'], [/内务府/, 'neiwufu'], [/都知监/, 'duzhi'], [/南书房/, 'nanshufang'],
  [/文华殿|经筵/, 'jingyan'], [/翰林/, 'hanlin'], [/国子监/, 'guozi'], [/同文馆|四夷馆/, 'tongwen'],
  [/太医院/, 'taiyi'], [/钦天监|司天|太史|历局/, 'sitian'], [/进奏|通政/, 'jinzou'], [/镇抚|锦衣/, 'zhenfu'],
  [/乾清/, 'qianqing'],
]

const BY_GROUP = {
  内阁: 'neige',
  六部: 'gongbu',
  内廷: 'qianqing',
  通政: 'jinzou',
  文教: 'hanlin',
  方技: 'taiyi',
  镇抚: 'zhenfu',
}

/** The building a Bot with no official of its own lodges in. */
export function buildingFor(bot, group) {
  const words = `${bot.name ?? ''} ${bot.role ?? ''}`
  for (const [pattern, building] of BY_WORD) if (pattern.test(words)) return building
  return BY_GROUP[group] ?? null
}
