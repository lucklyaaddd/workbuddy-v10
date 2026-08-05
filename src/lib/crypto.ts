/**
 * AES-256-GCM 加密工具（后端专用）
 * 用于 Bark 推送 URL 的加密存储与读取解密
 * 密钥由 Vercel 环境变量 BARK_ENCRYPTION_KEY 提供
 *
 * 安全规范：
 * - 前端永远无法获取明文 Bark URL
 * - 加密算法：AES-256-GCM（带认证标签，防篡改）
 * - 密钥不硬编码，仅从环境变量读取
 */

/**
 * 从环境变量获取加密密钥
 * @returns 32 字节密钥的 Buffer
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.BARK_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('[Crypto] BARK_ENCRYPTION_KEY 未配置或长度不正确（需要 64 个十六进制字符）');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * 加密字符串（AES-256-GCM）
 * @param plaintext 明文字符串（如 Bark URL）
 * @returns 加密后的字符串（格式：base64(iv:ciphertext:authTag)）
 */
export function encrypt(plaintext: string): string {
  const crypto = require('crypto');
  const key = getEncryptionKey();
  // 生成随机初始化向量（12 字节，GCM 推荐长度）
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // 加密数据
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 获取认证标签（16 字节，防篡改）
  const authTag = cipher.getAuthTag();

  // 组合 iv + 密文 + 认证标签，Base64 编码存储
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);

  return combined.toString('base64');
}

/**
 * 解密字符串（AES-256-GCM）
 * @param encryptedStr 加密字符串（encrypt() 的输出）
 * @returns 解密后的明文字符串
 */
export function decrypt(encryptedStr: string): string {
  const crypto = require('crypto');
  const key = getEncryptionKey();

  // Base64 解码
  const combined = Buffer.from(encryptedStr, 'base64');

  // 提取各部分：iv(12) + ciphertext + authTag(16)
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(12, combined.length - 16);

  // 创建解密器
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  // 解密
  let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 脱敏 Bark URL（前端展示用）
 * 仅显示前 4 位与后 4 位，中间用 * 替代
 * @param url 原始 Bark URL
 * @returns 脱敏后的字符串
 */
export function maskBarkUrl(url: string): string {
  if (!url || url.length <= 8) return '****';
  // 提取 Bark key 部分（URL 最后一段路径）
  const parts = url.split('/');
  const key = parts[parts.length - 1] || url;
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '*'.repeat(Math.min(key.length - 8, 20)) + key.substring(key.length - 4);
}
