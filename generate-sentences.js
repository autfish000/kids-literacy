// 为 words.js 中的每个字生成一条造句
const WORD_LIBRARY = require('./miniapp/utils/words.js');
const MINIAPP_PATH = './miniapp/utils/words.js';
const WEB_PATH = './words.js';

// 解析 example 提取第一个组词
function getFirstCizu(example) {
  if (!example) return '';
  const raw = example.replace(/^组词[：:]\s*/, '').trim();
  const parts = raw.split(/[、,，]/).map(s => s.trim()).filter(s => s);
  return parts[0] || '';
}

// 根据第一个组词生成造句
function makeSentence(char, firstCizu) {
  if (!firstCizu) return `${char}字真好看！`;

  // 用 firstCizu 的 hash 选择模板，保证同一词每次生成一致
  let hash = 0;
  for (let i = 0; i < firstCizu.length; i++) {
    hash += firstCizu.charCodeAt(i);
  }

  // 模板库：儿童学习风格、贴近生活
  const templates = [
    `${firstCizu}真好看！`,
    `我喜欢${firstCizu}。`,
    `${firstCizu}很有用。`,
    `今天我学会了${firstCizu}。`,
    `${firstCizu}是一个好词语。`,
    `${firstCizu}蓝蓝的。`,
    `${firstCizu}是我们的朋友。`,
    `${firstCizu}很有趣。`,
    `${firstCizu}真好吃！`,
    `小朋友都喜欢${firstCizu}。`,
    `${firstCizu}真美丽！`,
    `老师教我们认识了${firstCizu}。`,
    `${firstCizu}很漂亮。`,
    `${firstCizu}开得真艳。`,
    `今天学了${firstCizu}。`,
    `${firstCizu}真热闹。`,
    `${firstCizu}很快乐。`,
    `${firstCizu}在唱歌。`,
    `我每天都学习${firstCizu}。`,
    `${firstCizu}是一个有用的词。`,
  ];

  return templates[hash % templates.length];
}

// 为每个字添加 sentenceText 字段
const newLibrary = WORD_LIBRARY.map(word => {
  const firstCizu = getFirstCizu(word.example);
  const sentenceText = makeSentence(word.char, firstCizu);
  return {
    ...word,
    sentenceText,
  };
});

// 生成新的 JS 文件内容（保留原有格式风格）
const lines = [];
lines.push('const WORD_LIBRARY = [');
newLibrary.forEach((word, idx) => {
  const isLast = idx === newLibrary.length - 1;
  const line = `{ char: '${word.char}', pinyin: '${word.pinyin}', meaning: '${word.meaning}', example: '${word.example}', stroke: '${word.stroke || ''}', sentence: '${word.sentence}', sentenceText: '${word.sentenceText}', pic: '${word.pic}' }${isLast ? '' : ','}`;
  lines.push(line);
});
lines.push('];');
lines.push('module.exports = WORD_LIBRARY;');

const fs = require('fs');
fs.writeFileSync('./miniapp/utils/words.js', lines.join('\n'), 'utf-8');
console.log('✅ 已生成造句，共 ' + newLibrary.length + ' 条');

// 展示前20条样例
console.log('\n样例：');
newLibrary.slice(0, 20).forEach(w => {
  console.log(`  ${w.char} → ${w.sentenceText}`);
});
