/**
 * Utils - 工具函数集合
 * 通用的工具函数
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * 格式化速度
 */
export function formatSpeed(bytesPerSecond) {
  return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * 格式化时间
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '计算中...';

  if (seconds < 1) return '即将完成';
  if (seconds < 60) return `${Math.ceil(seconds)}秒`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return `${hours}小时${minutes}分钟`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 小于1分钟
  if (diff < 60000) return '刚刚';

  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 小于1天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 格式化为日期时间
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 生成唯一ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深拷贝
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * 获取文件类型图标
 */
export function getFileIcon(filename, mimeType) {
  const ext = getFileExtension(filename);

  // 图片
  if (/^image\//.test(mimeType) || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
    return '🖼️';
  }

  // 视频
  if (/^video\//.test(mimeType) || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(ext)) {
    return '🎬';
  }

  // 音频
  if (/^audio\//.test(mimeType) || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return '🎵';
  }

  // 文档
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽️';

  // 压缩包
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return '📦';
  }

  // 代码文件
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) {
    return '💻';
  }

  // 文本文件
  if (['txt', 'md', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
    return '📃';
  }

  return '📁';
}

/**
 * 检查是否为移动设备
 */
export function isMobile() {
  return /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * 检查是否为触摸设备
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * 显示通知
 */
export function showNotification(title, options = {}) {
  if (!('Notification' in window)) {
    console.log('Notification not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, options);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, options);
      }
    });
  }
}

/**
 * 休眠函数
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry(fn, maxAttempts = 3, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await sleep(delay * Math.pow(2, i)); // 指数退避
    }
  }
}

/**
 * 解析URL参数
 */
export function parseQueryString(url = window.location.search) {
  const params = new URLSearchParams(url);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * 构建URL参数
 */
export function buildQueryString(params) {
  return new URLSearchParams(params).toString();
}

export default {
  formatFileSize,
  formatSpeed,
  formatTime,
  formatDateTime,
  debounce,
  throttle,
  generateId,
  deepClone,
  getFileExtension,
  getFileIcon,
  isMobile,
  isTouchDevice,
  copyToClipboard,
  showNotification,
  sleep,
  retry,
  parseQueryString,
  buildQueryString
};
