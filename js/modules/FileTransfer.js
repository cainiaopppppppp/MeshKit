/**
 * FileTransfer - 文件传输模块
 * 处理文件的发送和接收
 */
import { eventBus } from '../core/EventBus.js';
import { config } from '../core/Config.js';
import { p2pManager } from '../core/P2PManager.js';

class FileTransfer {
  constructor() {
    this.currentFile = null;
    this.isTransferring = false;
    this.transferDirection = null; // 'send' or 'receive'

    // 发送状态
    this.sendConnection = null;
    this.sendProgress = 0;

    // 接收状态
    this.receiveMetadata = null;
    this.receiveChunks = [];
    this.receivedChunkCount = 0;
    this.downloadBlob = null;
    this.downloadFilename = null;

    // 传输统计
    this.transferStartTime = 0;
    this.transferredBytes = 0;

    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听P2P连接数据
    eventBus.on('p2p:connection:data', ({ conn, data, direction }) => {
      if (direction === 'incoming') {
        this.handleIncomingData(conn, data);
      }
    });

    // 监听连接打开
    eventBus.on('p2p:connection:open', ({ conn, direction }) => {
      if (direction === 'outgoing' && this.currentFile) {
        this.sendConnection = conn;
        this.startSending();
      }
    });

    // 监听连接错误
    eventBus.on('p2p:connection:error', ({ error, direction }) => {
      if (this.isTransferring) {
        this.handleTransferError(error);
      }
    });
  }

  /**
   * 选择文件
   */
  selectFile(file) {
    if (this.isTransferring) {
      console.warn('Transfer in progress, cannot select new file');
      return false;
    }

    this.currentFile = file;

    eventBus.emit('transfer:file-selected', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    return true;
  }

  /**
   * 发送文件
   */
  async sendFile(targetDeviceId) {
    if (!this.currentFile) {
      console.error('No file selected');
      return false;
    }

    if (this.isTransferring) {
      console.warn('Transfer already in progress');
      return false;
    }

    try {
      this.isTransferring = true;
      this.transferDirection = 'send';
      this.transferStartTime = Date.now();
      this.transferredBytes = 0;
      this.sendProgress = 0;

      eventBus.emit('transfer:started', {
        direction: 'send',
        file: {
          name: this.currentFile.name,
          size: this.currentFile.size,
          type: this.currentFile.type
        },
        targetDevice: targetDeviceId
      });

      // 建立P2P连接
      p2pManager.connect(targetDeviceId, {
        type: 'file-transfer',
        fileName: this.currentFile.name
      });

      return true;
    } catch (error) {
      this.handleTransferError(error);
      return false;
    }
  }

  /**
   * 开始发送文件
   */
  async startSending() {
    try {
      const conn = this.sendConnection;
      const file = this.currentFile;

      const chunkSize = config.get('transfer.chunkSize');
      const sendDelay = config.get('transfer.sendDelay');

      const fileBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(fileBuffer.byteLength / chunkSize);

      // 发送元数据
      conn.send({
        type: 'metadata',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks: totalChunks
      });

      // 发送分块
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileBuffer.byteLength);
        const chunk = fileBuffer.slice(start, end);

        conn.send({
          type: 'chunk',
          index: i,
          data: chunk
        });

        this.transferredBytes += (end - start);
        this.sendProgress = ((i + 1) / totalChunks) * 100;

        // 发送进度更新
        this.emitProgress('send');

        // 延迟（如果配置了）
        if (sendDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, sendDelay));
        }
      }

      // 发送完成标记
      conn.send({ type: 'complete' });

      this.handleTransferComplete('send');
    } catch (error) {
      this.handleTransferError(error);
    }
  }

  /**
   * 处理接收数据
   */
  handleIncomingData(conn, data) {
    if (data.type === 'metadata') {
      // 接收元数据
      this.receiveMetadata = data;
      this.receiveChunks = new Array(data.totalChunks);
      this.receivedChunkCount = 0;
      this.transferStartTime = Date.now();
      this.transferredBytes = 0;
      this.isTransferring = true;
      this.transferDirection = 'receive';

      eventBus.emit('transfer:started', {
        direction: 'receive',
        file: {
          name: data.name,
          size: data.size,
          type: data.mimeType
        }
      });
    }
    else if (data.type === 'chunk') {
      // 接收分块
      this.receiveChunks[data.index] = data.data;
      this.receivedChunkCount++;
      this.transferredBytes += data.data.byteLength;

      // 发送进度更新
      this.emitProgress('receive');
    }
    else if (data.type === 'complete') {
      // 接收完成
      this.assembleReceivedFile();
    }
  }

  /**
   * 组装接收的文件
   */
  assembleReceivedFile() {
    try {
      const blob = new Blob(this.receiveChunks, {
        type: this.receiveMetadata.mimeType
      });

      this.downloadBlob = blob;
      this.downloadFilename = this.receiveMetadata.name;

      this.handleTransferComplete('receive');
    } catch (error) {
      this.handleTransferError(error);
    }
  }

  /**
   * 触发下载（兼容iOS和所有移动设备）
   */
  downloadFile() {
    if (!this.downloadBlob || !this.downloadFilename) {
      console.error('No file available for download');
      return false;
    }

    try {
      const url = URL.createObjectURL(this.downloadBlob);

      // 检测iOS设备
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (isIOS || isSafari) {
        // iOS Safari特殊处理：打开新窗口显示文件
        // 用户可以长按保存
        const reader = new FileReader();
        reader.onload = (e) => {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.downloadFilename}</title>
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #f5f5f5;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  }
                  h2 { color: #333; margin-bottom: 20px; }
                  .filename {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 8px;
                    word-break: break-all;
                    margin: 20px 0;
                    color: #1976d2;
                  }
                  .info {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 20px 0;
                  }
                  a {
                    display: block;
                    background: linear-gradient(135deg, #4caf50, #45a049);
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    text-align: center;
                    font-weight: bold;
                    margin: 20px 0;
                  }
                  .steps {
                    background: #fff3e0;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #ff9800;
                  }
                  .steps ol {
                    margin: 10px 0;
                    padding-left: 20px;
                  }
                  .steps li {
                    margin: 8px 0;
                    color: #333;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h2>✅ 文件接收完成</h2>
                  <div class="filename">📄 ${this.downloadFilename}</div>
                  <p class="info">文件大小: ${this.formatFileSize(this.downloadBlob.size)}</p>

                  <a href="${e.target.result}" download="${this.downloadFilename}">
                    ⬇️ 点击下载文件
                  </a>

                  <div class="steps">
                    <strong>📱 iOS设备保存方法：</strong>
                    <ol>
                      <li>点击上方"下载文件"按钮</li>
                      <li>在新页面长按文件</li>
                      <li>选择"存储到文件"或"共享"</li>
                      <li>选择保存位置（如iCloud云盘）</li>
                    </ol>
                  </div>
                </div>
              </body>
              </html>
            `);
          } else {
            // 如果无法打开新窗口，尝试直接下载
            this.fallbackDownload(url);
          }
        };
        reader.readAsDataURL(this.downloadBlob);
      } else {
        // 非iOS设备使用标准下载方式
        this.fallbackDownload(url);
      }

      eventBus.emit('transfer:downloaded', {
        filename: this.downloadFilename,
        size: this.downloadBlob.size
      });

      return true;
    } catch (error) {
      console.error('Download failed:', error);
      eventBus.emit('transfer:download-error', { error });
      return false;
    }
  }

  /**
   * 标准下载方式（用于非iOS设备）
   */
  fallbackDownload(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = this.downloadFilename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  /**
   * 发送进度更新
   */
  emitProgress(direction) {
    const totalSize = direction === 'send'
      ? this.currentFile.size
      : this.receiveMetadata.size;

    const progress = direction === 'send'
      ? this.sendProgress
      : (this.receivedChunkCount / this.receiveMetadata.totalChunks) * 100;

    const elapsed = (Date.now() - this.transferStartTime) / 1000;
    const speed = this.transferredBytes / elapsed;
    const remaining = (totalSize - this.transferredBytes) / speed;

    eventBus.emit('transfer:progress', {
      direction,
      progress: progress.toFixed(1),
      transferred: this.transferredBytes,
      total: totalSize,
      speed: speed,
      remaining: remaining,
      speedMB: (speed / (1024 * 1024)).toFixed(2),
      remainingTime: this.formatTime(remaining)
    });
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '计算中...';
    if (seconds < 60) return `${Math.ceil(seconds)}秒`;
    return `${Math.ceil(seconds / 60)}分钟`;
  }

  /**
   * 处理传输完成
   */
  handleTransferComplete(direction) {
    const duration = (Date.now() - this.transferStartTime) / 1000;
    const avgSpeed = this.transferredBytes / duration;

    eventBus.emit('transfer:completed', {
      direction,
      duration,
      avgSpeed,
      avgSpeedMB: (avgSpeed / (1024 * 1024)).toFixed(2),
      totalBytes: this.transferredBytes,
      hasDownload: direction === 'receive'
    });

    // 如果是发送，重置状态
    if (direction === 'send') {
      this.reset();
    } else {
      // 接收完成，保留下载状态
      this.isTransferring = false;
    }
  }

  /**
   * 处理传输错误
   */
  handleTransferError(error) {
    console.error('Transfer error:', error);

    eventBus.emit('transfer:error', {
      error,
      direction: this.transferDirection
    });

    this.reset();
  }

  /**
   * 取消传输
   */
  cancelTransfer() {
    if (!this.isTransferring) return;

    if (this.sendConnection) {
      this.sendConnection.close();
    }

    eventBus.emit('transfer:cancelled', {
      direction: this.transferDirection
    });

    this.reset();
  }

  /**
   * 重置状态
   */
  reset() {
    this.isTransferring = false;
    this.transferDirection = null;
    this.sendConnection = null;
    this.sendProgress = 0;
    this.receiveMetadata = null;
    this.receiveChunks = [];
    this.receivedChunkCount = 0;
    this.transferStartTime = 0;
    this.transferredBytes = 0;
  }

  /**
   * 完全重置（包括下载）
   */
  fullReset() {
    this.reset();
    this.currentFile = null;
    this.downloadBlob = null;
    this.downloadFilename = null;
  }

  /**
   * 获取传输状态
   */
  getStatus() {
    return {
      isTransferring: this.isTransferring,
      direction: this.transferDirection,
      hasFile: !!this.currentFile,
      hasDownload: !!(this.downloadBlob && this.downloadFilename),
      progress: this.transferDirection === 'send' ? this.sendProgress :
                (this.receivedChunkCount / (this.receiveMetadata?.totalChunks || 1)) * 100
    };
  }
}

// 导出单例
export const fileTransfer = new FileTransfer();
export default FileTransfer;
