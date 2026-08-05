/**
 * 注册拦截接口
 * 公开注册已关闭，所有请求强制返回 403 Forbidden
 * 账号需由管理员手动创建
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** 处理跨域预检请求 */
function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * 注册处理器
 * 强制返回 403，拒绝所有公开注册请求
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  if (handleCors(req, res)) return;

  // 强制禁止公开注册
  return res.status(403).json({
    success: false,
    error: '公开注册已关闭，请联系管理员创建账号',
  });
}
