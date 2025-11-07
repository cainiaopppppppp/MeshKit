/**
 * UIManager - UI管理器
 * 统一管理所有UI更新和交互
 */
import { eventBus } from '../core/EventBus.js';
import { deviceManager } from '../modules/DeviceManager.js';
import { fileTransfer } from '../modules/FileTransfer.js';
import * as Components from './Components.js';
import { formatFileSize, formatSpeed } from '../utils/Utils.js';

class UIManager {
  constructor() {
    this.elements = {};
    this.currentMode = 'send';
    this.isInitialized = false;
  }

  /**
   * 初始化UI管理器
   */
  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupUIEventHandlers();
    this.isInitialized = true;
  }

  /**
   * 缓存DOM元素
   */
  cacheElements() {
    this.elements = {
      // 连接状态
      connectionStatus: document.getElementById('connectionStatus'),

      // 设备名称
      deviceNameInput: document.getElementById('deviceName'),

      // 模式切换
      modeTabs: document.querySelectorAll('.mode-tab'),
      sendPanel: document.getElementById('send-panel'),
      receivePanel: document.getElementById('receive-panel'),

      // 发送面板
      fileInput: document.getElementById('fileInput'),
      fileInfo: document.getElementById('fileInfo'),
      fileName: document.getElementById('fileName'),
      fileSize: document.getElementById('fileSize'),
      devicesList: document.getElementById('devicesList'),
      sendBtn: document.getElementById('sendBtn'),
      sendProgress: document.getElementById('sendProgress'),
      sendProgressBar: document.getElementById('sendProgressBar'),
      sendSpeedInfo: document.getElementById('sendSpeedInfo'),
      sendSpeed: document.getElementById('sendSpeed'),
      sendTime: document.getElementById('sendTime'),
      sendStatus: document.getElementById('sendStatus'),

      // 接收面板
      waitingState: document.getElementById('waitingState'),
      receiveProgress: document.getElementById('receiveProgress'),
      receiveProgressBar: document.getElementById('receiveProgressBar'),
      receiveSpeedInfo: document.getElementById('receiveSpeedInfo'),
      receiveSpeed: document.getElementById('receiveSpeed'),
      receiveTime: document.getElementById('receiveTime'),
      receiveStatus: document.getElementById('receiveStatus'),
      downloadReady: document.getElementById('downloadReady'),
      downloadBtn: document.getElementById('downloadBtn')
    };
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 信令连接状态
    eventBus.on('signaling:connected', () => {
      this.updateConnectionStatus(true);
    });

    eventBus.on('signaling:disconnected', () => {
      this.updateConnectionStatus(false);
    });

    // 设备列表
    eventBus.on('device:list-updated', ({ devices }) => {
      this.renderDeviceList(devices);
    });

    eventBus.on('device:selected', () => {
      this.updateSendButton();
    });

    eventBus.on('device:selection-cleared', () => {
      this.updateSendButton();
    });

    // 文件选择
    eventBus.on('transfer:file-selected', (fileInfo) => {
      this.showFileInfo(fileInfo);
      this.updateSendButton();
    });

    // 传输事件
    eventBus.on('transfer:started', ({ direction, file }) => {
      this.handleTransferStarted(direction, file);
    });

    eventBus.on('transfer:progress', (progress) => {
      this.updateProgress(progress);
    });

    eventBus.on('transfer:completed', (result) => {
      this.handleTransferCompleted(result);
    });

    eventBus.on('transfer:error', ({ error, direction }) => {
      this.handleTransferError(error, direction);
    });
  }

  /**
   * 设置UI事件处理
   */
  setupUIEventHandlers() {
    // 模式切换
    this.elements.modeTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (mode) this.switchMode(mode);
      });
    });

    // 文件选择
    this.elements.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileTransfer.selectFile(file);
      }
    });

    // 拖拽上传支持
    this.setupDragAndDrop();

    // 设备名称修改
    this.elements.deviceNameInput.addEventListener('change', (e) => {
      deviceManager.updateMyDeviceName(e.target.value);
      eventBus.emit('signaling:name-update', { name: e.target.value });
    });

    // 发送按钮
    this.elements.sendBtn.addEventListener('click', () => {
      this.handleSendFile();
    });

    // 下载按钮
    if (this.elements.downloadBtn) {
      this.elements.downloadBtn.addEventListener('click', () => {
        fileTransfer.downloadFile();
      });
    }

    // 设备列表点击委托
    this.elements.devicesList.addEventListener('click', (e) => {
      const deviceItem = e.target.closest('.device-item');
      if (deviceItem) {
        const deviceId = deviceItem.dataset.deviceId;
        deviceManager.selectDevice(deviceId);
        this.renderDeviceList(deviceManager.getAllDevices());
      }
    });
  }

  /**
   * 更新连接状态
   */
  updateConnectionStatus(connected) {
    const status = this.elements.connectionStatus;
    if (connected) {
      status.className = 'connection-status connected';
      status.textContent = '✅ 已连接';
    } else {
      status.className = 'connection-status disconnected';
      status.textContent = '⚠️ 未连接';
    }
  }

  /**
   * 切换模式
   */
  switchMode(mode) {
    this.currentMode = mode;

    // 更新标签
    this.elements.modeTabs.forEach(tab => {
      if (tab.dataset.mode === mode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 更新面板
    if (mode === 'send') {
      this.elements.sendPanel.classList.add('active');
      this.elements.receivePanel.classList.remove('active');
    } else {
      this.elements.sendPanel.classList.remove('active');
      this.elements.receivePanel.classList.add('active');
    }
  }

  /**
   * 显示文件信息
   */
  showFileInfo(fileInfo) {
    this.elements.fileName.textContent = fileInfo.name;
    this.elements.fileSize.textContent = formatFileSize(fileInfo.size);
    this.elements.fileInfo.style.display = 'block';
  }

  /**
   * 渲染设备列表
   */
  renderDeviceList(devices) {
    const container = this.elements.devicesList;

    if (devices.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="font-size: 14px; color: #999;">
            未发现其他设备<br>
            请确保其他设备也打开了此页面
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const selectedId = deviceManager.selectedDeviceId;

    devices.forEach(device => {
      const deviceEl = Components.createDeviceItem(device, device.id === selectedId);
      container.appendChild(deviceEl);
    });
  }

  /**
   * 更新发送按钮状态
   */
  updateSendButton() {
    const hasFile = fileTransfer.currentFile !== null;
    const hasSelectedDevice = deviceManager.selectedDeviceId !== null;
    this.elements.sendBtn.disabled = !hasFile || !hasSelectedDevice;
  }

  /**
   * 处理发送文件
   */
  async handleSendFile() {
    const selectedDevice = deviceManager.getSelectedDevice();
    if (!selectedDevice) {
      Components.showToast('请选择目标设备', 'error');
      return;
    }

    const success = await fileTransfer.sendFile(selectedDevice.id);
    if (!success) {
      Components.showToast('发送失败', 'error');
    }
  }

  /**
   * 处理传输开始
   */
  handleTransferStarted(direction, file) {
    if (direction === 'send') {
      this.showStatus('sendStatus', '📤 发送中...', 'info');
      this.elements.sendProgress.style.display = 'block';
      this.elements.sendSpeedInfo.style.display = 'flex';
      this.elements.sendBtn.disabled = true;
    } else {
      this.showStatus('receiveStatus', '📥 接收中...', 'info');
      this.elements.waitingState.style.display = 'none';
      this.elements.receiveProgress.style.display = 'block';
      this.elements.receiveSpeedInfo.style.display = 'flex';
    }
  }

  /**
   * 更新进度
   */
  updateProgress(progress) {
    const { direction, progress: percent, speedMB, remainingTime } = progress;

    if (direction === 'send') {
      this.elements.sendProgressBar.style.width = `${percent}%`;
      this.elements.sendSpeed.textContent = `速度: ${speedMB} MB/s`;
      this.elements.sendTime.textContent = `剩余: ${remainingTime}`;
    } else {
      this.elements.receiveProgressBar.style.width = `${percent}%`;
      this.elements.receiveSpeed.textContent = `速度: ${speedMB} MB/s`;
      this.elements.receiveTime.textContent = `剩余: ${remainingTime}`;
    }
  }

  /**
   * 处理传输完成
   */
  handleTransferCompleted(result) {
    const { direction, avgSpeedMB, hasDownload } = result;

    if (direction === 'send') {
      this.showStatus('sendStatus', `✅ 发送完成！平均速度: ${avgSpeedMB} MB/s`, 'success');
      this.elements.sendBtn.disabled = false;

      // 3秒后隐藏进度条
      setTimeout(() => {
        this.elements.sendProgress.style.display = 'none';
        this.elements.sendSpeedInfo.style.display = 'none';
      }, 3000);
    } else {
      this.elements.receiveProgress.style.display = 'none';
      this.elements.receiveSpeedInfo.style.display = 'none';

      if (hasDownload) {
        // 显示下载按钮
        this.elements.downloadReady.style.display = 'block';
        const filename = fileTransfer.downloadFilename;
        const filesize = fileTransfer.downloadBlob.size;

        this.elements.downloadReady.querySelector('.download-filename').textContent = filename;
        this.elements.downloadReady.querySelector('.download-filesize').textContent = formatFileSize(filesize);
      }
    }

    Components.showToast('传输完成！', 'success');
  }

  /**
   * 处理传输错误
   */
  handleTransferError(error, direction) {
    const message = `❌ ${direction === 'send' ? '发送' : '接收'}失败: ${error.message || error}`;

    if (direction === 'send') {
      this.showStatus('sendStatus', message, 'error');
      this.elements.sendBtn.disabled = false;
    } else {
      this.showStatus('receiveStatus', message, 'error');
    }

    Components.showToast('传输失败', 'error');
  }

  /**
   * 显示状态消息
   */
  showStatus(elementId, message, type) {
    const statusDiv = this.elements[elementId];
    if (statusDiv) {
      statusDiv.className = `status ${type}`;
      statusDiv.textContent = message;
      statusDiv.style.display = 'block';
    }
  }

  /**
   * 隐藏状态消息
   */
  hideStatus(elementId) {
    const statusDiv = this.elements[elementId];
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }
  }

  /**
   * 设置拖拽上传
   */
  setupDragAndDrop() {
    const fileInputWrapper = document.getElementById('fileInputWrapper');
    if (!fileInputWrapper) return;

    // 点击上传
    fileInputWrapper.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    // 阻止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      fileInputWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // 拖拽进入时高亮
    ['dragenter', 'dragover'].forEach(eventName => {
      fileInputWrapper.addEventListener(eventName, () => {
        fileInputWrapper.classList.add('drag-over');
      });
    });

    // 拖拽离开时取消高亮
    ['dragleave', 'drop'].forEach(eventName => {
      fileInputWrapper.addEventListener(eventName, () => {
        fileInputWrapper.classList.remove('drag-over');
      });
    });

    // 处理文件放置
    fileInputWrapper.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        fileTransfer.selectFile(file);
      }
    });

    // 触摸设备优化
    if ('ontouchstart' in window) {
      fileInputWrapper.addEventListener('touchstart', (e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      });

      fileInputWrapper.addEventListener('touchend', (e) => {
        e.currentTarget.style.transform = 'scale(1)';
      });
    }
  }

  /**
   * 重置UI
   */
  reset() {
    // 重置文件信息
    this.elements.fileInfo.style.display = 'none';

    // 重置进度
    this.elements.sendProgress.style.display = 'none';
    this.elements.sendSpeedInfo.style.display = 'none';
    this.elements.receiveProgress.style.display = 'none';
    this.elements.receiveSpeedInfo.style.display = 'none';

    // 重置下载
    this.elements.downloadReady.style.display = 'none';

    // 重置状态
    this.hideStatus('sendStatus');
    this.hideStatus('receiveStatus');

    // 启用按钮
    this.elements.sendBtn.disabled = true;
  }
}

// 导出单例
export const uiManager = new UIManager();
export default UIManager;
