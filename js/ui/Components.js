/**
 * Components - UI组件
 * 提供可复用的UI组件
 */
import { formatFileSize, getFileIcon } from '../utils/Utils.js';

/**
 * 创建状态消息组件
 */
export function createStatusMessage(message, type = 'info') {
  const div = document.createElement('div');
  div.className = `status ${type}`;
  div.textContent = message;
  return div;
}

/**
 * 创建设备列表项
 */
export function createDeviceItem(device, isSelected = false) {
  const div = document.createElement('div');
  div.className = `device-item ${isSelected ? 'selected' : ''}`;
  div.dataset.deviceId = device.id;

  const icon = device.name.includes('📱') ? '📱' : '💻';

  div.innerHTML = `
    <div class="device-icon">${icon}</div>
    <div class="device-info">
      <div class="device-name-text">${device.name}</div>
    </div>
  `;

  return div;
}

/**
 * 创建空状态组件
 */
export function createEmptyState(icon, title, subtitle) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 15px;">${icon}</div>
    <p style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">
      ${title}
    </p>
    ${subtitle ? `<p style="font-size: 14px; color: #666;">${subtitle}</p>` : ''}
  `;
  return div;
}

/**
 * 创建文件信息卡片
 */
export function createFileInfoCard(file) {
  const div = document.createElement('div');
  div.className = 'file-info-card';

  const icon = getFileIcon(file.name, file.type);
  const size = formatFileSize(file.size);

  div.innerHTML = `
    <div class="file-icon-large">${icon}</div>
    <div class="file-details">
      <div class="file-name">${file.name}</div>
      <div class="file-size">${size}</div>
    </div>
  `;

  return div;
}

/**
 * 创建进度条
 */
export function createProgressBar(progress = 0) {
  const container = document.createElement('div');
  container.className = 'progress-bar';

  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${progress}%`;

  container.appendChild(fill);
  return container;
}

/**
 * 创建下载卡片
 */
export function createDownloadCard(filename, filesize) {
  const div = document.createElement('div');
  div.className = 'download-ready';

  div.innerHTML = `
    <h2>✅ 文件接收完成！</h2>
    <p class="download-filename" style="font-size: 16px; font-weight: 600;">${filename}</p>
    <p class="download-filesize" style="font-size: 14px;">${formatFileSize(filesize)}</p>
    <button class="btn btn-download" id="downloadBtn">
      ⬇️ 点击下载文件
    </button>
    <p style="font-size: 12px; margin-top: 15px; opacity: 0.8;">
      请点击按钮下载文件
    </p>
  `;

  return div;
}

/**
 * 创建加载动画
 */
export function createLoadingSpinner(text = '加载中...') {
  const div = document.createElement('div');
  div.className = 'loading-spinner';
  div.innerHTML = `
    <div class="spinner"></div>
    <p>${text}</p>
  `;
  return div;
}

/**
 * 创建提示消息（Toast）
 */
export function showToast(message, type = 'info', duration = 3000) {
  // 移除已存在的toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // 添加显示动画
  setTimeout(() => toast.classList.add('show'), 10);

  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * 创建确认对话框
 */
export function showConfirmDialog(title, message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  dialog.innerHTML = `
    <h3>${title}</h3>
    <p>${message}</p>
    <div class="dialog-buttons">
      <button class="btn btn-secondary" id="cancelBtn">取消</button>
      <button class="btn btn-primary" id="confirmBtn">确认</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 添加显示动画
  setTimeout(() => overlay.classList.add('show'), 10);

  // 按钮事件
  dialog.querySelector('#confirmBtn').onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };

  dialog.querySelector('#cancelBtn').onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  // 点击背景关闭
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  };
}

/**
 * 创建模态框
 */
export function showModal(title, content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-content">
      ${content}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 添加显示动画
  setTimeout(() => overlay.classList.add('show'), 10);

  // 关闭按钮
  modal.querySelector('.modal-close').onclick = () => {
    overlay.remove();
  };

  // 点击背景关闭
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };

  return overlay;
}

export default {
  createStatusMessage,
  createDeviceItem,
  createEmptyState,
  createFileInfoCard,
  createProgressBar,
  createDownloadCard,
  createLoadingSpinner,
  showToast,
  showConfirmDialog,
  showModal
};
