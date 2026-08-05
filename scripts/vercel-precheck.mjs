import { readFileSync } from 'fs';
const cfg = JSON.parse(readFileSync('E:/mini-workbench/vercel.json', 'utf-8'));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Vercel 部署前预检');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 检查 1: 无 functions.runtime 版本号问题
if (cfg.functions) {
  const r = cfg.functions['api/**/*.ts']?.runtime;
  const hasVersion = r && /@\d/.test(r);
  console.log('[1] functions.runtime:', r || '(未设置)', hasVersion ? '❌ 含版本号' : '✅ 无版本号');
} else {
  console.log('[1] functions 段已删除 ✅ Vercel 自动检测 api/ 默认最新 @vercel/node');
}

// 检查 2: 6 个 cron 表达式频率 (Hobby 限制)
console.log('\n[2] Cron 频率检查 (Hobby 限制每天 ≤1 次):');
const CRON_DAILY_LIMIT = 1;
for (const c of cfg.crons || []) {
  const s = c.schedule;
  let daily = 0;
  if (s === '* * * * *') daily = 1440;
  else if (/^\*\/\d+ \* \* \*$/.test(s)) daily = 24 / parseInt(s.split('/')[1].split(' ')[0]);
  else if (/^0 \*\/\d+ \* \* \*$/.test(s)) daily = 24 / parseInt(s.split('/')[1].split(' ')[0]);
  else if (/^\d+ \d+ \* \* \*$/.test(s)) daily = 1;
  else if (/^\d+ \d+ \d+ \* \*$/.test(s)) daily = 1 / 30;
  else if (/^\d+ \d+ \d+ \d+ \*$/.test(s)) daily = 1 / 365;
  else daily = 1;
  const flag = daily > CRON_DAILY_LIMIT ? '❌ 超限' : '✅';
  console.log('     ' + c.path.padEnd(28) + ' ' + s.padEnd(15) + ' ≈ 每天 ' + daily.toFixed(2) + ' 次 ' + flag);
}

// 检查 3: buildCommand + outputDirectory
const buildOk = !!(cfg.buildCommand && cfg.outputDirectory);
console.log('\n[3] Build:', cfg.buildCommand, '→', cfg.outputDirectory, buildOk ? '✅' : '❌');

// 检查 4: framework
console.log('[4] Framework:', cfg.framework || '(未设置)', cfg.framework === 'vite' ? '✅' : '⚠️');

console.log('\n✅ 预检完成');
