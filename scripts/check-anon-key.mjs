// 从 .env 加载所有变量
import { readFileSync } from 'fs';
const env = readFileSync('E:/mini-workbench/.env', 'utf-8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=');
    if (i > 0) acc[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    return acc;
  }, {});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 WorkBuddy 启动期自检');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('URL:     ', url);
console.log('Key 前缀:', key.substring(0, 12) + '...' + key.substring(key.length - 4));
console.log('Key 长度:', key.length, '字符');
console.log('Key 格式:', key.startsWith('sb_publishable_') ? 'publishable (新格式)' : key.startsWith('eyJ') ? 'JWT (传统)' : '其他');
console.log('');

// 四种测试
const tests = [
  { name: '【1】Supabase 直连 settings (验证 key)', target: `${url}/auth/v1/settings` },
  { name: '【2】本地代理 settings (验证 key+代理)', target: 'http://localhost:3000/__supabase/auth/v1/settings' },
  { name: '【3】本地代理 auth/token (用错密码)',   target: 'http://localhost:3000/__supabase/auth/v1/token?grant_type=password', method: 'POST', body: JSON.stringify({email:'1412369010@qq.com',password:'x'}) },
  { name: '【4】本地代理 auth/token (乱账号乱密码)', target: 'http://localhost:3000/__supabase/auth/v1/token?grant_type=password', method: 'POST', body: JSON.stringify({email:'noexist@no.com',password:'y'}) },
];

for (const t of tests) {
  console.log(t.name);
  try {
    const res = await fetch(t.target, {
      method: t.method || 'GET',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: t.body,
    });
    console.log('   返回状态:', res.status);
    const text = await res.text();
    console.log('   响应体 :', text.substring(0, 200));
    let verdict = '⚠️ 其他';
    if (res.ok) verdict = '✅ OK';
    else if (text.includes('Invalid API key')) verdict = '❌ anon key 被服务端拒绝';
    else if (text.includes('No API key')) verdict = '❌ apikey header 没传过去';
    else if (text.includes('invalid_credentials')) verdict = '🟡 key有效，但账号密码错';
    console.log('   判定   :', verdict);
  } catch (e) {
    console.log('   ❌ 网络异常:', e.message);
  }
  console.log('');
}
