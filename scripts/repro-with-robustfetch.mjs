// 复现前端浏览器行为：supabase-js + robustFetch (跟前端 supabase.ts 一样的逻辑)
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

// ============ 复制前端的 robustFetch ============
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

function rewriteToLocalProxy(url) {
  return url.replace(/^https?:\/\/[^/]+\.supabase\.co/, '/__supabase');
}

async function robustFetch(input, init) {
  let rewrittenInput = input;
  let rewrittenInit = init;
  if (typeof input === 'string') {
    const rewritten = rewriteToLocalProxy(input);
    if (rewritten !== input) rewrittenInput = rewritten;
  } else if (input instanceof URL) {
    const rewritten = rewriteToLocalProxy(input.toString());
    if (rewritten !== input.toString()) rewrittenInput = rewritten;
  } else {
    // Request 对象
    const req = input;
    const rewritten = rewriteToLocalProxy(req.url);
    if (rewritten !== req.url) {
      try {
        rewrittenInput = new Request(rewritten, req);
      } catch {
        rewrittenInput = rewritten;
        rewrittenInit = init;
      }
    }
  }

  const url = typeof rewrittenInput === 'string'
    ? rewrittenInput
    : rewrittenInput instanceof URL
      ? rewrittenInput.toString()
      : rewrittenInput.url;

  console.log('🔄 robustFetch 拦截到请求:');
  console.log('   原始 URL    :', input instanceof Request ? input.url : input.toString());
  console.log('   重写后 URL  :', url);
  console.log('   走代理 ?    :', url.startsWith('/__supabase') ? '✅ 是' : '❌ 否（仍然直连外网）');
  console.log('   apikey      :', (init?.headers?.apikey || init?.headers?.['apikey'])?.substring(0, 12) + '...');
  console.log('');

  return fetch(rewrittenInput, rewrittenInit);
}

// ============ 创建 supabase-js 客户端 ============
const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: robustFetch },
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 用前端 supabase.ts 同样的 robustFetch 测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const { data, error } = await client.auth.signInWithPassword({
  email: '1412369010@qq.com',
  password: '故意错的密码',
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 结果');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('error.message:', error?.message);
console.log('error.status :', error?.status);
