// 用真实的 supabase-js v2.112 复现前端 login 调用
// 这能告诉我们前端实际是怎么发请求的
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('E:/mini-workbench/.env', 'utf-8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=');
    if (i > 0) acc[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    return acc;
  }, {});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 复现 supabase-js 客户端实际行为');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('使用真实 anon key:', env.VITE_SUPABASE_ANON_KEY.substring(0, 12) + '...');
console.log('目标 URL:', env.VITE_SUPABASE_URL);
console.log('');

// 用真实 supabase-js 客户端（带 fetch 拦截器看实际请求）
let lastRequest = null;
const wrappedFetch = async (url, options = {}) => {
  lastRequest = {
    url,
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  };
  console.log('📡 supabase-js 发起请求:');
  console.log('   URL:    ', url);
  console.log('   Method: ', options.method || 'GET');
  console.log('   Headers:', JSON.stringify(options.headers, null, 2));
  console.log('');
  console.log('   关键检查点：');
  console.log('   - apikey header:', options.headers?.apikey ? `✅ "${options.headers.apikey.substring(0, 12)}..."` : '❌ 缺失!');
  console.log('   - authorization :', options.headers?.Authorization ? `✅ "${options.headers.Authorization.substring(0, 20)}..."` : '⚠️ 无（密码登录正常）');
  console.log('');

  // 实际执行
  const res = await fetch(url, options);
  const text = await res.text();
  console.log('📥 响应:', res.status, text.substring(0, 250));
  console.log('');
  // 重新包装 Response
  return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
};

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: wrappedFetch },
});

console.log('⏳ 调用 signInWithPassword（用用户实际填的账号 + 故意错密码）');
console.log('');

const { data, error } = await client.auth.signInWithPassword({
  email: '1412369010@qq.com',
  password: '故意错的密码',
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 最终结果');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('data:  ', data);
console.log('error: ', error);
if (error) {
  console.log('error.message:', error.message);
  console.log('error.status :', error.status);
  console.log('error.name   :', error.name);
}
