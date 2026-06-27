/**
 * 前端错误工具，负责从异常对象中提取统一可读的错误文案。
 */
export function getErrorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error ? error.message : fallback;
}
