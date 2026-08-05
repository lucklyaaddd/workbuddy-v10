/**
 * 统一响应辅助函数
 * 提供标准化的 JSON 响应格式，确保所有 API 返回格式一致
 */
import type { VercelResponse } from '@vercel/node';

/** 成功响应格式 */
interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/** 分页响应格式 */
interface PaginateResponse<T = any> {
  success: true;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 错误响应格式 */
interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * 返回成功响应
 * @param res Vercel 响应对象
 * @param data 响应数据
 * @param message 可选的成功消息
 * @param statusCode HTTP 状态码，默认 200
 */
export function success<T>(
  res: VercelResponse,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const body: SuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

/**
 * 返回错误响应
 * @param res Vercel 响应对象
 * @param statusCode HTTP 状态码
 * @param message 错误消息
 */
export function error(
  res: VercelResponse,
  statusCode: number,
  message: string
): void {
  const body: ErrorResponse = { success: false, error: message };
  res.status(statusCode).json(body);
}

/**
 * 返回分页响应
 * @param res Vercel 响应对象
 * @param data 数据列表
 * @param total 总记录数
 * @param page 当前页码
 * @param pageSize 每页大小
 */
export function paginate<T>(
  res: VercelResponse,
  data: T[],
  total: number,
  page: number,
  pageSize: number
): void {
  const body: PaginateResponse<T> = {
    success: true,
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
  res.status(200).json(body);
}
