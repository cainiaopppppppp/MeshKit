/**
 * Logger - 日志工具
 * 统一的日志管理系统，支持不同级别和格式化
 */
import { config } from '../core/Config.js';

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // 最多保存1000条日志
  }

  /**
   * 检查是否应该记录
   */
  shouldLog(level) {
    if (!config.get('debug.enabled')) {
      return level === 'error' || level === 'warn';
    }

    const configLevel = config.get('debug.logLevel');
    const levels = ['debug', 'info', 'warn', 'error'];
    const configIndex = levels.indexOf(configLevel);
    const currentIndex = levels.indexOf(level);

    return currentIndex >= configIndex;
  }

  /**
   * 格式化日志
   */
  formatLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level] || '';

    return {
      timestamp,
      level,
      emoji,
      message,
      data
    };
  }

  /**
   * 记录日志
   */
  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatLog(level, message, data);

    // 保存到内存
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 输出到控制台
    const consoleMethod = console[level] || console.log;
    const prefix = `${logEntry.emoji} [${level.toUpperCase()}]`;

    if (data) {
      consoleMethod(prefix, message, data);
    } else {
      consoleMethod(prefix, message);
    }
  }

  /**
   * Debug级别日志
   */
  debug(message, data) {
    this.log('debug', message, data);
  }

  /**
   * Info级别日志
   */
  info(message, data) {
    this.log('info', message, data);
  }

  /**
   * Warn级别日志
   */
  warn(message, data) {
    this.log('warn', message, data);
  }

  /**
   * Error级别日志
   */
  error(message, data) {
    this.log('error', message, data);
  }

  /**
   * 获取所有日志
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * 按级别获取日志
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * 清除日志
   */
  clear() {
    this.logs = [];
  }

  /**
   * 导出日志（文本格式）
   */
  exportText() {
    return this.logs.map(log => {
      const dataStr = log.data ? ` - ${JSON.stringify(log.data)}` : '';
      return `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${dataStr}`;
    }).join('\n');
  }

  /**
   * 导出日志（JSON格式）
   */
  exportJSON() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 下载日志文件
   */
  download(format = 'text') {
    const content = format === 'json' ? this.exportJSON() : this.exportText();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `p2p-transfer-log-${Date.now()}.${format === 'json' ? 'json' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// 导出单例
export const logger = new Logger();
export default Logger;
