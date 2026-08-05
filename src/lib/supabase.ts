/**
 * Supabase 客户端初始化
 * 前端使用 anon key（低权限），所有高权限操作走后端 API
 *
 * 【已加固】自带 fetch 详细诊断与重试，解决浏览器侧 "Failed to fetch" 黑盒问题
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============ 环境变量读取 ============
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 启动时自检：环境变量缺失会立即报错而不是默默返回错误
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] ❌ 环境变量缺失！请检查 .env 文件：\n' +
      '  VITE_SUPABASE_URL: ' + (supabaseUrl ? '✅' : '❌ 缺失\n  请确认 .env 中此行格式为 VITE_SUPABASE_URL=https://xxx.supabase.co（无空格）') + '\n' +
      '  VITE_SUPABASE_ANON_KEY: ' + (supabaseAnonKey ? '✅' : '❌ 缺失')
  );
} else {
  console.info('[Supabase] ✅ 已加载：' + supabaseUrl);
}

/**
 * 增强版 fetch：捕获详细错误 + 自动重试 + 反向代理重写
 *
 * 【解决】浏览器侧 "Failed to fetch" 黑盒错误：
 *   1. 把 https://*.supabase.co/* 重写为 /__supabase/*（Vite 反向代理）
 *      → 浏览器永远不直接访问外部 supabase.co，绕开代理/扩展拦截
 *   2. 失败后自动重试一次（处理瞬断）
 *   3. 抛出带详细诊断信息的 Error
 *
 * 【关键修复】v2 重写时使用 location.origin 拼成绝对 URL：
 *   supabase-js v2.112 内部用 `fetch(rewrittenUrl)` 直接调用，不补 origin，
 *   相对路径 `/__supabase/...` 在 fetch() 解析时会抛 "Failed to parse URL"，
 *   导致整套登录静默失败并报奇怪的 "Invalid API key"。
 *   解决：转成 http://localhost:3000/__supabase/... 绝对 URL。
 */
function rewriteToLocalProxy(url: string): string {
  // 仅在开发环境重写
  if (!import.meta.env.DEV) return url;
  // 把 https://*.supabase.co/* 改成本地 /__supabase/*
  const replaced = url.replace(/^https?:\/\/[^/]+\.supabase\.co/, '/__supabase');
  if (replaced === url) return url;
  // 强制转成绝对 URL（浏览器 fetch 不接受裸相对路径）
  if (typeof window !== 'undefined' && replaced.startsWith('/')) {
    return `${window.location.origin}${replaced}`;
  }
  return replaced;
}

async function robustFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // ⭐ 关键：把外网 URL 重写为本地代理 URL
  let rewrittenInput = input;
  let rewrittenInit = init;
  if (typeof input === 'string') {
    const rewritten = rewriteToLocalProxy(input);
    if (rewritten !== input) {
      rewrittenInput = rewritten;
    }
  } else if (input instanceof URL) {
    const rewritten = rewriteToLocalProxy(input.toString());
    if (rewritten !== input.toString()) {
      rewrittenInput = rewritten;
    }
  } else {
    // Request 对象
    const req = input as Request;
    const rewritten = rewriteToLocalProxy(req.url);
    if (rewritten !== req.url) {
      try {
        rewrittenInput = new Request(rewritten, req);
      } catch {
        // 兼容性回退
        rewrittenInput = rewritten;
        rewrittenInit = init;
      }
    }
  }

  const url = typeof rewrittenInput === 'string'
    ? rewrittenInput
    : rewrittenInput instanceof URL
      ? rewrittenInput.toString()
      : (rewrittenInput as Request).url;
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const startTime = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.debug(`[Supabase fetch] 尝试 ${attempt}/2: ${method} ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
      const response = await fetch(rewrittenInput, rewrittenInit);
      const elapsed = Date.now() - startTime;
      console.debug(`[Supabase fetch] ✅ ${response.status} (${elapsed}ms)`);
      return response;
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      const e = err as Error;
      // 提取详细错误信息
      const errorType = e?.name || 'UnknownError';
      const errorMsg = e?.message || String(err);

      // 失败诊断（5 种最常见原因）
      let diagnosis = '';
      if (!navigator.onLine) {
        diagnosis = '🌐 网络已断开 - 请检查 WiFi/有线网络';
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        diagnosis = '🚫 网络请求失败 - 可能原因：\n' +
          '   1) 浏览器扩展/广告拦截器拦截了请求（请尝试无痕模式）\n' +
          '   2) 公司/校园代理阻止了 *.supabase.co\n' +
          '   3) DNS 解析失败（尝试 ping vidpnamyhxqaghakbzvf.supabase.co）\n' +
          '   4) 防火墙/安全软件拦截';
      } else if (errorMsg.includes('CORS')) {
        diagnosis = '🔀 CORS 跨域错误 - 检查 Supabase Dashboard 的 API 设置';
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
        diagnosis = '🔒 SSL/TLS 错误 - 检查系统时间和证书';
      } else {
        diagnosis = '❓ 未知网络错误';
      }

      console.error(
        `[Supabase fetch] ❌ 尝试 ${attempt}/2 失败 (${elapsed}ms)\n` +
          `  URL: ${url}\n` +
          `  方法: ${method}\n` +
          `  错误类型: ${errorType}\n` +
          `  错误信息: ${errorMsg}\n` +
          `  诊断: ${diagnosis}\n` +
          `  navigator.onLine: ${navigator.onLine}`
      );

      if (attempt === 1) {
        // 第一次失败，等待 800ms 重试一次（处理瞬断）
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      // 第二次失败，抛出带诊断的 Error
      const detailedError = new Error(
        `网络请求失败（已重试 1 次）\n` +
          `URL: ${url}\n` +
          `诊断: ${diagnosis}\n` +
          `原始错误: ${errorMsg}`
      );
      (detailedError as Error & { code?: string }).code = errorType === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
      throw detailedError;
    }
  }

  // 永远不会到这里（TypeScript 兜底）
  throw new Error('unreachable');
}

// 单例
let supabaseInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端实例
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        flowType: 'pkce',
      },
      // ⭐ 关键：注入增强版 fetch，自动重试 + 详细错误
      global: {
        headers: { 'x-client-info': 'workbuddy-v10' },
        fetch: robustFetch as typeof fetch,
      },
      realtime: {
        params: { eventsPerSecond: 2 },
      },
    });
  }
  return supabaseInstance;
}

/** Supabase 客户端单例 */
export const supabase = getSupabase();

// ============ 认证辅助函数 ============

/**
 * 获取当前登录用户ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * 获取当前会话 token
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * 邮箱密码登录（含详细错误处理）
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  } catch (err: unknown) {
    // 捕获网络层错误（fetch 失败重试后仍失败的场景）
    const e = err as Error & { code?: string };
    console.error('[Login] 登录失败:', e);
    return {
      data: { user: null, session: null },
      error: {
        name: e.name || 'NetworkError',
        message: e.message || '登录失败',
        status: 0,
      } as { name: string; message: string; status: number },
    };
  }
}

/**
 * 发送密码重置邮件
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });
  return { data, error };
}

/**
 * 退出登录
 * 清理本地会话和离线缓存中的敏感数据
 */
export async function signOut() {
  // 清理 IndexedDB 中的离线数据
  try {
    const { clearOfflineData } = await import('@/lib/idb');
    await clearOfflineData();
  } catch (e) {
    console.warn('[Auth] 清理离线数据失败', e);
  }
  // 调用后端清理设备推送订阅
  try {
    const token = await getAccessToken();
    if (token) {
      await fetch('/api/bark/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    }
  } catch (e) {
    console.warn('[Auth] 清理推送订阅失败', e);
  }
  // Supabase 退出
  await supabase.auth.signOut();
}

// ============ 环境变量导出（用于调试） ============
export const debugConfig = {
  supabaseUrl,
  // 仅暴露 key 的前 12 位和后 4 位用于调试（绝不暴露完整 key）
  supabaseKeyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 12)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 4)}` : '(缺失)',
  supabaseKeyLength: supabaseAnonKey.length,
  supabaseKeyFormat: supabaseAnonKey.startsWith('sb_publishable_')
    ? 'publishable（新格式，supabase-js v2.46+ 支持）'
    : supabaseAnonKey.startsWith('eyJ')
      ? 'JWT（传统格式）'
      : supabaseAnonKey
        ? '未知格式'
        : '缺失',
  isConfigured: !!supabaseUrl && !!supabaseAnonKey,
};

/**
 * 启动期自检：验证 anon key 是否被 Supabase 服务端认可
 * 结果输出到 console，方便排查 "Invalid API key" 类问题
 *
 * 调用：等待 dev proxy 启动后 1.5s 自动执行（不阻塞 UI）
 */
if (typeof window !== 'undefined' && import.meta.env.DEV && supabaseUrl && supabaseAnonKey) {
  setTimeout(async () => {
    try {
      // 用 robustFetch 自动走本地代理，不产生 CORS
      const url = rewriteToLocalProxy(`${supabaseUrl}/auth/v1/settings`);
      const res = await fetch(url, { headers: { apikey: supabaseAnonKey } });
      console.info(`[Supabase 自检] settings endpoint -> HTTP ${res.status}`);
      if (res.ok) {
        console.info('%c[Supabase 自检] ✅ anon key 被服务端认可', 'color: green; font-weight: bold');
        console.info('  URL:    ', debugConfig.supabaseUrl);
        console.info('  Key:    ', debugConfig.supabaseKeyPreview);
        console.info('  长度:   ', debugConfig.supabaseKeyLength, '字符');
        console.info('  格式:   ', debugConfig.supabaseKeyFormat);
      } else {
        console.error(`[Supabase 自检] ❌ anon key 被服务端拒绝 (HTTP ${res.status})`);
        const body = await res.text();
        console.error('  响应体:', body.substring(0, 200));
      }
    } catch (err) {
      console.error('[Supabase 自检] ❌ 网络异常:', err);
    }
  }, 1500);
}
