/**
 * Vite 本地开发中间件：Bark 推送 API
 * 让前端在本地 dev 环境下也能测试 Bark 推送，无需部署到 Vercel
 *
 * 覆盖路由：
 *   POST   /api/bark/subscribe       保存 Bark URL（加密存储）
 *   POST   /api/bark/test            发送测试推送
 *   GET    /api/bark/subscriptions   列出已绑定设备（脱敏）
 *   DELETE /api/bark/subscriptions   删除设备订阅
 *
 * 仅在 dev 环境生效，生产环境走 Vercel Serverless Functions
 */
import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

// ============ 加密辅助（与 src/lib/crypto.ts 保持一致） ============

function getEncKey(keyHex: string): Buffer {
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('BARK_ENCRYPTION_KEY 未配置或长度不正确（需 64 位 hex）');
  }
  return Buffer.from(keyHex, 'hex');
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]).toString('base64');
}

function decrypt(encryptedStr: string, key: Buffer): string {
  const combined = Buffer.from(encryptedStr, 'base64');
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(12, combined.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskBarkUrl(url: string): string {
  if (!url || url.length <= 8) return '****';
  const parts = url.split('/');
  const key = parts[parts.length - 1] || url;
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '*'.repeat(Math.min(key.length - 8, 20)) + key.substring(key.length - 4);
}

// ============ HTTP 辅助 ============

function sendJson(res: ServerResponse, status: number, data: any): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function extractBearer(header: any): string | null {
  if (!header) return null;
  const str = Array.isArray(header) ? header[0] : header;
  const m = str.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// ============ 插件主体 ============

export function barkDevApiPlugin(): Plugin {
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let encKey: Buffer | null = null;

  return {
    name: 'bark-dev-api',
    apply: 'serve', // 仅 dev 生效
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const supabaseUrl = env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
      const barkKeyHex = env.BARK_ENCRYPTION_KEY;

      if (!supabaseUrl || !serviceRoleKey || !barkKeyHex) {
        server.config.logger.warn('[bark-dev-api] 环境变量缺失（VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / BARK_ENCRYPTION_KEY），Bark 本地 API 不可用');
        return;
      }

      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      encKey = getEncKey(barkKeyHex);
      server.config.logger.info('[bark-dev-api] ✅ Bark 本地 API 已就绪（/api/bark/*）');

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/bark/')) return next();

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        try {
          // 鉴权
          const token = extractBearer(req.headers.authorization || req.headers.Authorization);
          if (!token) return sendJson(res, 401, { success: false, error: '未提供认证令牌' });

          const { data: { user }, error: authErr } = await supabaseAdmin!.auth.getUser(token);
          if (authErr || !user) {
            return sendJson(res, 401, { success: false, error: '认证令牌无效或已过期' });
          }
          const userId = user.id;

          const path = url.split('?')[0];
          const query = new URLSearchParams(url.split('?')[1] || '');

          // ============ POST /subscribe ============
          if (path === '/api/bark/subscribe' && req.method === 'POST') {
            const body = await parseBody(req);
            const barkUrl: string = (body.barkUrl || '').trim();
            const deviceName: string = (body.deviceName || '').trim() || '未知设备';

            if (!barkUrl) return sendJson(res, 400, { success: false, error: '缺少 barkUrl' });
            if (!barkUrl.startsWith('https://api.day.app/')) {
              return sendJson(res, 400, { success: false, error: '仅支持 https://api.day.app/ 开头的 Bark URL' });
            }
            if (deviceName.length > 50) {
              return sendJson(res, 400, { success: false, error: '设备名称过长' });
            }

            const encrypted = encrypt(barkUrl, encKey!);
            const { data, error: insertErr } = await supabaseAdmin!
              .from('push_subscriptions')
              .insert({
                user_id: userId,
                type: 'bark',
                endpoint: encrypted,
                device_name: deviceName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (insertErr) {
              console.error('[bark-dev-api] subscribe 失败:', insertErr.message);
              return sendJson(res, 500, { success: false, error: '保存订阅失败: ' + insertErr.message });
            }

            return sendJson(res, 200, {
              success: true,
              data: { id: data.id, endpoint: maskBarkUrl(barkUrl), deviceName },
            });
          }

          // ============ POST /test ============
          if (path === '/api/bark/test' && req.method === 'POST') {
            const { data: subs, error: queryErr } = await supabaseAdmin!
              .from('push_subscriptions')
              .select('*')
              .eq('user_id', userId)
              .eq('type', 'bark');

            if (queryErr) return sendJson(res, 500, { success: false, error: '查询订阅失败' });
            if (!subs || subs.length === 0) {
              return sendJson(res, 404, { success: false, error: '未找到 Bark 推送订阅，请先添加设备' });
            }

            const results: any[] = [];
            for (const sub of subs) {
              try {
                const endpoint = decrypt(sub.endpoint, encKey!);
                const pushResp = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: '📢 推送测试',
                    body: '🎉 这是一条来自 WorkBuddy 的测试推送！如果你收到了这条消息，说明推送配置正确。',
                    group: 'WorkBuddy',
                    level: 'timeSensitive',
                    sound: 'notification',
                  }),
                });
                const pushData: any = await pushResp.json().catch(() => ({}));
                results.push({
                  device: sub.device_name || '未知设备',
                  success: pushResp.status === 200,
                  message: pushResp.status === 200 ? '推送成功' : `推送失败: ${pushData.message || 'HTTP ' + pushResp.status}`,
                });
              } catch (e: any) {
                results.push({
                  device: sub.device_name || '未知设备',
                  success: false,
                  message: '推送请求失败: ' + e.message,
                });
              }
            }

            return sendJson(res, 200, {
              success: true,
              data: {
                allSuccess: results.every((r) => r.success),
                totalDevices: results.length,
                successCount: results.filter((r) => r.success).length,
                results,
              },
            });
          }

          // ============ GET /subscriptions ============
          if (path === '/api/bark/subscriptions' && req.method === 'GET') {
            const { data, error } = await supabaseAdmin!
              .from('push_subscriptions')
              .select('id, device_name, endpoint, created_at')
              .eq('user_id', userId)
              .eq('type', 'bark')
              .order('created_at', { ascending: false });

            if (error) return sendJson(res, 500, { success: false, error: '查询失败' });

            const list = (data || []).map((item: any) => ({
              ...item,
              endpoint: maskBarkUrl(decrypt(item.endpoint, encKey!)),
            }));

            return sendJson(res, 200, { success: true, data: list });
          }

          // ============ DELETE /subscriptions?id=xxx ============
          if (path === '/api/bark/subscriptions' && req.method === 'DELETE') {
            const id = query.get('id');
            if (!id) return sendJson(res, 400, { success: false, error: '缺少订阅 ID' });

            const { error: delErr } = await supabaseAdmin!
              .from('push_subscriptions')
              .delete()
              .eq('id', id)
              .eq('user_id', userId);

            if (delErr) return sendJson(res, 500, { success: false, error: '删除失败: ' + delErr.message });

            return sendJson(res, 200, { success: true });
          }

          return sendJson(res, 404, { success: false, error: '路由不存在' });
        } catch (e: any) {
          console.error('[bark-dev-api] 异常:', e);
          return sendJson(res, 500, { success: false, error: e.message || '服务器错误' });
        }
      });
    },
  };
}
