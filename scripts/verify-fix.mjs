// 模拟浏览器环境验证修复
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

// 模拟 window
globalThis.window = { location: { origin: 'http://localhost:3000' } };

function rewriteToLocalProxy(url) {
  if (url.replace(/^https?:\/\/[^/]+\.supabase\.co/, '/__supabase') === url) return url;
  const replaced = url.replace(/^https?:\/\/[^/]+\.supabase\.co/, '/__supabase');
  if (typeof window !== 'undefined' && replaced.startsWith('/')) {
    return `${window.location.origin}${replaced}`;
  }
  return replaced;
}

async function robustFetch(input, init) {
  let rewrittenInput = input;
  let rewrittenInit = init;
  if (typeof input === 'string') {
    const r = rewriteToLocalProxy(input);
    if (r !== input) rewrittenInput = r;
  } else if (input instanceof URL) {
    const r = rewriteToLocalProxy(input.toString());
    if (r !== input.toString()) rewrittenInput = r;
  } else {
    const r = rewriteToLocalProxy(input.url);
    if (r !== input.url) {
      try { rewrittenInput = new Request(r, input); }
      catch { rewrittenInput = r; rewrittenInit = init; }
    }
  }

  const url = typeof rewrittenInput === 'string' ? rewrittenInput
    : rewrittenInput instanceof URL ? rewrittenInput.toString()
    : rewrittenInput.url;

  console.log('🔄 robustFetch 重写');
  console.log('   入参 URL:', input instanceof Request ? input.url : input.toString());
  console.log('   出参 URL:', url);
  console.log('   绝对 URL？:', url.startsWith('http://') || url.startsWith('https://') ? '✅' : '❌');
  console.log('');

  return fetch(rewrittenInput, rewrittenInit);
}

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: robustFetch },
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 验证修复后的 robustFetch');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const { data, error } = await client.auth.signInWithPassword({
  email: '1412369010@qq.com',
  password: '故意错的密码',
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 最终结果');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('error.message:', error?.message);
console.log('error.status :', error?.status);
console.log('');
if (error?.message?.includes('Invalid login credentials')) {
  console.log('✅ 修复成功！现在能正确打到 Supabase，返回 invalid_credentials');
  console.log('   下一步：用真实密码登录');
} else if (error?.message?.includes('Failed to parse URL')) {
  console.log('❌ 修复失败！URL 仍未转绝对');
} else {
  console.log('⚠️ 其他结果:', error?.message);
}
