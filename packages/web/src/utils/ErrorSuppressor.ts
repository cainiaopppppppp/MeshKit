/**
 * 全局错误抑制器
 * 用于过滤浏览器扩展产生的错误，避免污染控制台
 */

// 需要抑制的错误模式
const SUPPRESSED_ERROR_PATTERNS = [
  /content-all\.js/i,  // 浏览器扩展
  /Failed to execute 'removeChild' on 'Node'/i,  // DOM操作错误（通常来自扩展）
  /The node to be removed is not a child of this node/i,  // DOM操作错误
  /extension\//i,  // 浏览器扩展路径
  /chrome-extension:\/\//i,  // Chrome扩展
  /moz-extension:\/\//i,  // Firefox扩展
];

/**
 * 初始化全局错误抑制器
 */
export function initErrorSuppressor() {
  // 拦截全局错误
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    const errorSource = event.filename || '';

    // 检查是否是需要抑制的错误
    const shouldSuppress = SUPPRESSED_ERROR_PATTERNS.some(
      (pattern) => pattern.test(errorMessage) || pattern.test(errorSource)
    );

    if (shouldSuppress) {
      // 阻止错误传播到控制台
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // 拦截未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason?.toString() || '';

    const shouldSuppress = SUPPRESSED_ERROR_PATTERNS.some((pattern) =>
      pattern.test(reason)
    );

    if (shouldSuppress) {
      event.preventDefault();
      return false;
    }
  });

  console.log('[ErrorSuppressor] Initialized - browser extension errors will be suppressed');
}
