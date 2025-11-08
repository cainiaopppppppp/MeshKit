/**
 * FileTransferManager - 文件传输管理器
 * 处理文件的发送和接收
 */
import type { DataConnection } from 'peerjs';
import { eventBus } from '../utils/EventBus';
import { config } from '../utils/Config';
import { p2pManager } from './P2PManager';
import type { FileMetadata, ChunkData, TransferDirection } from '../types';

export class FileTransferManager {
  private currentFile: File | null = null;
  private isTransferring: boolean = false;
  private transferDirection: TransferDirection | null = null;

  // 发送状态
  private sendConnection: DataConnection | null = null;
  private sendProgress: number = 0;
  private pendingAcks: Map<number, (value: void) => void> = new Map(); // 等待ACK的Promise resolvers
  private lastAckedIndex: number = -1; // 最后确认的chunk索引

  // 接收状态
  private receiveMetadata: FileMetadata | null = null;
  private receiveConnection: DataConnection | null = null;
  private receiveChunks: Map<number, ArrayBuffer> = new Map(); // 使用Map存储，支持乱序
  private receivedChunkCount: number = 0;
  private receiveBlobParts: Blob[] = []; // 分批合并的Blob数组
  private nextBatchIndex: number = 0; // 下一个要合并的批次起始索引
  private downloadBlob: Blob | null = null;
  private downloadFilename: string = '';
  private readonly BATCH_SIZE = 100; // 每100个chunks合并一次（100MB）

  // 传输统计
  private transferStartTime: number = 0;
  private transferredBytes: number = 0;
  private transferTimeout: number | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听P2P连接数据
    eventBus.on('p2p:connection:data', ({ data }) => {
      this.handleIncomingData(data);
    });

    // 监听连接打开
    eventBus.on('p2p:connection:open', ({ peer, direction }) => {
      if (direction === 'outgoing' && this.currentFile) {
        const conn = p2pManager.getConnection(peer, 'outgoing');
        if (conn) {
          this.sendConnection = conn;
          this.startSending();
        }
      } else if (direction === 'incoming') {
        // 保存接收连接，用于发送ACK
        const conn = p2pManager.getConnection(peer, 'incoming');
        if (conn) {
          this.receiveConnection = conn;
        }
      }
    });

    // 监听连接错误
    eventBus.on('p2p:connection:error', ({ error }) => {
      if (this.isTransferring) {
        this.handleTransferError(error);
      }
    });
  }

  /**
   * 选择文件
   */
  async selectFile(file: File): Promise<boolean> {
    if (this.isTransferring) {
      console.warn('[FileTransferManager] Transfer in progress');
      return false;
    }

    // 验证文件可读性
    try {
      console.log(`[FileTransferManager] Validating file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      await this.validateFileReadable(file);
      console.log('[FileTransferManager] File validation passed');
    } catch (error) {
      console.error('[FileTransferManager] File validation failed:', error);
      eventBus.emit('transfer:error', {
        error: new Error(`文件无法读取: ${(error as Error).message}`),
        direction: 'send',
      });
      return false;
    }

    this.currentFile = file;

    eventBus.emit('transfer:file-selected', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    return true;
  }

  /**
   * 验证文件是否可读（读取前1KB测试）
   */
  private async validateFileReadable(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const testBlob = file.slice(0, 1024); // 只读取前1KB测试

      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('File read timeout'));
      }, 5000);

      reader.onload = () => {
        clearTimeout(timeout);
        resolve();
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(reader.error || new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(testBlob);
    });
  }

  /**
   * 发送文件
   */
  async sendFile(targetDeviceId: string): Promise<boolean> {
    if (!this.currentFile) {
      console.error('[FileTransferManager] No file selected');
      return false;
    }

    if (this.isTransferring) {
      console.warn('[FileTransferManager] Transfer already in progress');
      return false;
    }

    try {
      console.log(`[FileTransferManager] Preparing to send ${this.currentFile.name} (${(this.currentFile.size / 1024 / 1024).toFixed(2)} MB)`);

      // 立即显示准备状态（重要：即时反馈）
      eventBus.emit('transfer:preparing', {
        direction: 'send',
        file: {
          name: this.currentFile.name,
          size: this.currentFile.size,
          type: this.currentFile.type,
        },
      });

      this.isTransferring = true;
      this.transferDirection = 'send';
      this.transferStartTime = Date.now();
      this.transferredBytes = 0;
      this.sendProgress = 0;

      // 建立P2P连接
      console.log(`[FileTransferManager] Connecting to ${targetDeviceId}...`);
      p2pManager.connect(targetDeviceId, {
        type: 'file-transfer',
        fileName: this.currentFile.name,
        fileSize: this.currentFile.size,
      });

      // 连接建立后会触发 transfer:started 事件
      return true;
    } catch (error) {
      this.handleTransferError(error as Error);
      return false;
    }
  }

  /**
   * 开始发送文件（流式读取 + 背压控制）
   */
  private async startSending(): Promise<void> {
    if (!this.sendConnection || !this.currentFile) return;

    try {
      const file = this.currentFile;

      // 再次验证文件可读性（连接建立可能需要时间）
      console.log('[FileTransfer] Re-validating file before transfer...');
      try {
        await this.validateFileReadable(file);
        console.log('[FileTransfer] File re-validation passed');
      } catch (error) {
        throw new Error(`文件已不可读，可能被移动或删除: ${(error as Error).message}`);
      }

      const chunkSize = config.get('transfer').chunkSize;
      const sendDelay = config.get('transfer').sendDelay;
      const timeout = config.get('transfer').timeout;
      const totalChunks = Math.ceil(file.size / chunkSize);

      console.log(`[FileTransfer] Connection established, starting transfer...`);
      console.log(`[FileTransfer] File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[FileTransfer] Chunks: ${totalChunks} x ${(chunkSize / 1024).toFixed(0)} KB`);

      // 触发传输开始事件
      eventBus.emit('transfer:started', {
        direction: 'send',
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      });

      // 设置传输超时
      this.setupTransferTimeout(timeout);

      // 发送元数据
      this.sendConnection.send({
        type: 'metadata',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks: totalChunks,
      } as ChunkData);

      // 流式读取并发送分块
      for (let i = 0; i < totalChunks; i++) {
        // 背压控制：检查缓冲区大小
        await this.waitForBufferDrain();

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);

        // 逐块读取文件，避免一次性读入内存
        const chunk = await this.readFileChunk(file, start, end);

        this.sendConnection.send({
          type: 'chunk',
          index: i,
          data: chunk,
        } as ChunkData);

        // 等待ACK确认（关键！确保接收方收到了）
        try {
          await this.waitForAck(i, 10000); // 10秒ACK超时
        } catch (error) {
          console.error(`[FileTransfer] ACK timeout for chunk ${i}:`, error);
          throw error; // 传输失败
        }

        this.transferredBytes += chunk.byteLength;

        // 基于ACK计算进度（更准确！）
        this.sendProgress = ((this.lastAckedIndex + 1) / totalChunks) * 100;

        // 发送进度更新（每10个chunk或最后一个chunk）
        if (i % 10 === 0 || i === totalChunks - 1) {
          this.emitProgress('send', file.size);
        }

        // 延迟（如果配置了）
        if (sendDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, sendDelay));
        }
      }

      // 发送完成标记
      this.sendConnection.send({ type: 'complete' } as ChunkData);

      console.log('[FileTransfer] Send completed');
      this.clearTransferTimeout();
      this.handleTransferComplete('send');
    } catch (error) {
      this.clearTransferTimeout();
      this.handleTransferError(error as Error);
    }
  }

  /**
   * 流式读取文件块（避免大文件内存溢出）
   * 带重试机制
   */
  private async readFileChunk(file: File, start: number, end: number, retries = 3): Promise<ArrayBuffer> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.readFileChunkOnce(file, start, end);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[FileTransfer] Chunk read attempt ${attempt + 1}/${retries} failed:`, error);

        // 如果不是最后一次尝试，等待一下再重试
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    // 所有重试都失败
    throw new Error(`文件读取失败（已重试${retries}次）: ${lastError?.message}`);
  }

  /**
   * 单次读取文件块
   */
  private readFileChunkOnce(file: File, start: number, end: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const blob = file.slice(start, end);

      // 设置超时
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('File chunk read timeout'));
      }, 10000); // 10秒超时

      reader.onload = (e) => {
        clearTimeout(timeout);
        if (e.target?.result) {
          resolve(e.target.result as ArrayBuffer);
        } else {
          reject(new Error('Failed to read file chunk'));
        }
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        const error = reader.error || new Error('FileReader error');
        console.error('[FileTransfer] FileReader error:', {
          name: error.name,
          message: error.message,
          start,
          end,
          fileSize: file.size,
          fileName: file.name,
        });
        reject(error);
      };

      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * 背压控制：等待缓冲区排空
   * WebRTC数据通道有16MB缓冲区限制，增强版本包含超时和日志
   */
  private async waitForBufferDrain(): Promise<void> {
    if (!this.sendConnection) return;

    const MAX_BUFFER_SIZE = 4 * 1024 * 1024; // 降低到4MB阈值，更保守
    const MAX_WAIT_TIME = 30000; // 30秒超时

    // 访问底层的RTCDataChannel来获取bufferSize
    const dataChannel = (this.sendConnection as any).dataChannel;
    if (!dataChannel) return;

    const startTime = Date.now();
    let lastLogTime = startTime;

    while (dataChannel.bufferedAmount > MAX_BUFFER_SIZE) {
      const elapsed = Date.now() - startTime;

      // 超时检查
      if (elapsed > MAX_WAIT_TIME) {
        console.error('[FileTransfer] Buffer drain timeout!', {
          bufferedAmount: dataChannel.bufferedAmount,
          maxBufferSize: MAX_BUFFER_SIZE,
          elapsedTime: elapsed,
        });
        throw new Error('Buffer drain timeout - connection may be stuck');
      }

      // 每5秒打印一次日志
      if (Date.now() - lastLogTime > 5000) {
        console.log('[FileTransfer] Waiting for buffer drain...', {
          bufferedAmount: (dataChannel.bufferedAmount / 1024 / 1024).toFixed(2) + ' MB',
          threshold: (MAX_BUFFER_SIZE / 1024 / 1024).toFixed(2) + ' MB',
        });
        lastLogTime = Date.now();
      }

      // 等待100ms，给缓冲区更多时间排空
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 设置传输超时
   */
  private setupTransferTimeout(timeout: number): void {
    this.clearTransferTimeout();

    if (timeout > 0) {
      this.transferTimeout = window.setTimeout(() => {
        console.error('[FileTransfer] Transfer timeout');
        this.handleTransferError(new Error('Transfer timeout'));
      }, timeout);
    }
  }

  /**
   * 清除传输超时
   */
  private clearTransferTimeout(): void {
    if (this.transferTimeout !== null) {
      clearTimeout(this.transferTimeout);
      this.transferTimeout = null;
    }
  }

  /**
   * 发送ACK确认
   */
  private sendAck(chunkIndex: number): void {
    if (!this.receiveConnection) {
      console.warn('[FileTransfer] No receive connection to send ACK');
      return;
    }

    try {
      this.receiveConnection.send({
        type: 'ack',
        ackIndex: chunkIndex,
      } as ChunkData);
    } catch (error) {
      console.error('[FileTransfer] Failed to send ACK:', error);
    }
  }

  /**
   * 处理ACK确认
   */
  private handleAck(chunkIndex: number): void {
    this.lastAckedIndex = chunkIndex;

    // 解决等待该ACK的Promise
    const resolver = this.pendingAcks.get(chunkIndex);
    if (resolver) {
      resolver();
      this.pendingAcks.delete(chunkIndex);
    }
  }

  /**
   * 等待ACK确认（带超时）
   */
  private async waitForAck(chunkIndex: number, timeoutMs: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(chunkIndex);
        reject(new Error(`ACK timeout for chunk ${chunkIndex}`));
      }, timeoutMs);

      // 保存resolver
      this.pendingAcks.set(chunkIndex, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * 处理接收数据
   */
  private handleIncomingData(data: ChunkData): void {
    if (data.type === 'metadata') {
      // 接收元数据
      this.receiveMetadata = {
        name: data.name!,
        size: data.size!,
        type: data.mimeType!,
        totalChunks: data.totalChunks,
      };
      this.receiveChunks.clear();
      this.receiveBlobParts = [];
      this.nextBatchIndex = 0;
      this.receivedChunkCount = 0;
      this.transferStartTime = Date.now();
      this.transferredBytes = 0;
      this.isTransferring = true;
      this.transferDirection = 'receive';

      // 设置接收超时
      const timeout = config.get('transfer').timeout;
      this.setupTransferTimeout(timeout);

      console.log(`[FileTransfer] Receiving ${data.name} (${(data.size! / 1024 / 1024).toFixed(2)} MB) in ${data.totalChunks} chunks`);

      eventBus.emit('transfer:started', {
        direction: 'receive',
        file: {
          name: data.name!,
          size: data.size!,
          type: data.mimeType!,
        },
      });
    } else if (data.type === 'chunk') {
      // 接收分块
      if (data.index !== undefined && data.data) {
        this.receiveChunks.set(data.index, data.data);
        this.receivedChunkCount++;
        this.transferredBytes += data.data.byteLength;

        // 发送ACK确认（关键！让发送方知道已收到）
        this.sendAck(data.index);

        // 尝试合并连续的chunks，避免内存溢出（关键优化！）
        this.tryMergeBatch();

        // 发送进度更新（每10个chunk或接近完成）
        if (this.receiveMetadata) {
          if (this.receivedChunkCount % 10 === 0 ||
              this.receivedChunkCount === this.receiveMetadata.totalChunks) {
            this.emitProgress('receive', this.receiveMetadata.size);
          }
        }
      }
    } else if (data.type === 'ack') {
      // 收到ACK确认
      if (data.ackIndex !== undefined) {
        this.handleAck(data.ackIndex);
      }
    } else if (data.type === 'complete') {
      // 接收完成
      console.log('[FileTransfer] Receive completed');
      this.clearTransferTimeout();
      this.assembleReceivedFile();
    }
  }

  /**
   * 尝试合并批次chunks
   * 检查是否有连续的BATCH_SIZE个chunks可以合并
   */
  private tryMergeBatch(): void {
    if (!this.receiveMetadata) return;

    // 收集从nextBatchIndex开始的连续chunks
    const batchChunks: ArrayBuffer[] = [];
    let index = this.nextBatchIndex;

    while (index < this.receiveMetadata.totalChunks! && batchChunks.length < this.BATCH_SIZE) {
      const chunk = this.receiveChunks.get(index);
      if (!chunk) break; // 遇到缺失的chunk，停止

      batchChunks.push(chunk);
      index++;
    }

    // 如果收集到足够的chunks，或者已经是最后一批，就合并
    if (batchChunks.length >= this.BATCH_SIZE ||
       (index === this.receiveMetadata.totalChunks && batchChunks.length > 0)) {

      console.log(`[FileTransfer] Merging batch: ${this.nextBatchIndex} to ${index - 1} (${batchChunks.length} chunks)`);

      // 合并成Blob
      try {
        const batchBlob = new Blob(batchChunks, {
          type: this.receiveMetadata.type,
        });
        this.receiveBlobParts.push(batchBlob);

        // 删除已合并的chunks，释放内存
        for (let i = this.nextBatchIndex; i < index; i++) {
          this.receiveChunks.delete(i);
        }

        this.nextBatchIndex = index;

        console.log(`[FileTransfer] Memory freed: ${batchChunks.length} chunks, Map size now: ${this.receiveChunks.size}`);
      } catch (error) {
        console.error('[FileTransfer] Failed to merge batch:', error);
      }
    }
  }

  /**
   * 组装接收的文件（优化内存使用）
   */
  private assembleReceivedFile(): void {
    if (!this.receiveMetadata) return;

    try {
      console.log(`[FileTransfer] Assembling file from ${this.receiveBlobParts.length} blob parts`);

      // 合并剩余的chunks
      const remainingChunks: ArrayBuffer[] = [];
      for (let i = this.nextBatchIndex; i < this.receiveMetadata.totalChunks!; i++) {
        const chunk = this.receiveChunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk at index ${i}`);
        }
        remainingChunks.push(chunk);
      }

      if (remainingChunks.length > 0) {
        console.log(`[FileTransfer] Merging final ${remainingChunks.length} chunks`);
        const finalBlob = new Blob(remainingChunks, {
          type: this.receiveMetadata.type,
        });
        this.receiveBlobParts.push(finalBlob);
      }

      // 合并所有Blob部分（远少于原始chunk数量）
      console.log(`[FileTransfer] Creating final blob from ${this.receiveBlobParts.length} parts`);
      const blob = new Blob(this.receiveBlobParts, {
        type: this.receiveMetadata.type,
      });

      this.downloadBlob = blob;
      this.downloadFilename = this.receiveMetadata.name;

      console.log(`[FileTransfer] File assembled successfully: ${this.downloadFilename} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);

      // 先触发完成事件（设置UI状态）
      this.handleTransferComplete('receive');

      // 立即自动触发下载（关键改进！）
      console.log('[FileTransfer] Auto-triggering download...');
      setTimeout(() => {
        this.downloadFile();

        // 下载完成后清理内存
        this.receiveChunks.clear();
        this.receiveBlobParts = [];
        this.nextBatchIndex = 0;
      }, 500); // 延迟500ms，确保UI已更新

    } catch (error) {
      console.error('[FileTransfer] Failed to assemble file:', error);
      this.handleTransferError(error as Error);
    }
  }

  /**
   * 触发下载
   */
  downloadFile(): boolean {
    if (!this.downloadBlob || !this.downloadFilename) {
      console.error('[FileTransferManager] No file available for download');
      return false;
    }

    try {
      const url = URL.createObjectURL(this.downloadBlob);

      // 检测iOS设备
      const isIOS =
        typeof navigator !== 'undefined' &&
        /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari =
        typeof navigator !== 'undefined' &&
        /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (isIOS || isSafari) {
        // iOS特殊处理
        this.downloadFileIOS(url);
      } else {
        // 标准下载
        this.downloadFileStandard(url);
      }

      eventBus.emit('transfer:downloaded', {
        filename: this.downloadFilename,
        size: this.downloadBlob.size,
      });

      return true;
    } catch (error) {
      console.error('[FileTransferManager] Download failed:', error);
      return false;
    }
  }

  /**
   * 标准下载方式
   */
  private downloadFileStandard(url: string): void {
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
   * iOS下载方式
   */
  private downloadFileIOS(url: string): void {
    // iOS需要在新窗口打开，用户手动保存
    // 注意：自动触发可能被浏览器拦截
    try {
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        console.warn('[FileTransfer] Popup blocked - user needs to click download button');
        // 弹窗被拦截，需要用户手动点击
        eventBus.emit('transfer:download-blocked', {
          reason: 'popup-blocked',
        });
      }
    } catch (error) {
      console.error('[FileTransfer] Failed to open download window:', error);
    }
  }

  /**
   * 发送进度更新
   */
  private emitProgress(direction: TransferDirection, totalSize: number): void {
    const progress =
      direction === 'send'
        ? this.sendProgress
        : this.receiveMetadata
        ? (this.receivedChunkCount / this.receiveMetadata.totalChunks!) * 100
        : 0;

    const elapsed = (Date.now() - this.transferStartTime) / 1000;
    const speed = this.transferredBytes / elapsed;
    const remaining = (totalSize - this.transferredBytes) / speed;

    eventBus.emit('transfer:progress', {
      direction,
      progress: Number(progress.toFixed(1)),
      transferred: this.transferredBytes,
      total: totalSize,
      speed: speed,
      remaining: remaining,
      speedMB: (speed / (1024 * 1024)).toFixed(2),
      remainingTime: this.formatTime(remaining),
    });
  }

  /**
   * 格式化时间
   */
  private formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '计算中...';
    if (seconds < 60) return `${Math.ceil(seconds)}秒`;
    return `${Math.ceil(seconds / 60)}分钟`;
  }

  /**
   * 处理传输完成
   */
  private handleTransferComplete(direction: TransferDirection): void {
    const duration = (Date.now() - this.transferStartTime) / 1000;
    const avgSpeed = this.transferredBytes / duration;

    eventBus.emit('transfer:completed', {
      direction,
      duration,
      avgSpeed,
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
  private handleTransferError(error: Error): void {
    console.error('[FileTransferManager] Transfer error:', error);

    eventBus.emit('transfer:error', {
      error,
      direction: this.transferDirection || 'send',
    });

    this.reset();
  }

  /**
   * 取消传输
   */
  cancelTransfer(): void {
    if (!this.isTransferring) return;

    if (this.sendConnection) {
      this.sendConnection.close();
    }

    eventBus.emit('transfer:cancelled', {
      direction: this.transferDirection || 'send',
    });

    this.reset();
  }

  /**
   * 重置状态
   */
  private reset(): void {
    this.clearTransferTimeout();
    this.isTransferring = false;
    this.transferDirection = null;
    this.sendConnection = null;
    this.sendProgress = 0;
    this.receiveMetadata = null;
    this.receiveChunks.clear();
    this.receiveBlobParts = [];
    this.nextBatchIndex = 0;
    this.receivedChunkCount = 0;
    this.transferStartTime = 0;
    this.transferredBytes = 0;
  }

  /**
   * 完全重置（包括下载）
   */
  fullReset(): void {
    this.reset();
    this.currentFile = null;
    this.downloadBlob = null;
    this.downloadFilename = '';
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
      progress:
        this.transferDirection === 'send'
          ? this.sendProgress
          : this.receiveMetadata
          ? (this.receivedChunkCount / this.receiveMetadata.totalChunks!) * 100
          : 0,
    };
  }

  /**
   * 获取当前文件
   */
  getCurrentFile(): File | null {
    return this.currentFile;
  }

  /**
   * 获取下载信息
   */
  getDownloadInfo(): { blob: Blob; filename: string } | null {
    if (!this.downloadBlob || !this.downloadFilename) return null;
    return {
      blob: this.downloadBlob,
      filename: this.downloadFilename,
    };
  }
}

// 导出单例
export const fileTransferManager = new FileTransferManager();
