/**
 * FileTransferManager - 文件传输管理器
 * 处理文件的发送和接收
 */
import type { DataConnection } from 'peerjs';
import { eventBus } from '../utils/EventBus';
import { config } from '../utils/Config';
import { p2pManager } from './P2PManager';
import type { FileMetadata, ChunkData, TransferDirection } from '../types';
// @ts-ignore - StreamSaver doesn't have types
import streamSaver from 'streamsaver';

export class FileTransferManager {
  private currentFile: File | null = null;
  private isTransferring: boolean = false;
  private transferDirection: TransferDirection | null = null;

  // 发送状态（点对点模式）
  private sendConnection: DataConnection | null = null;
  private sendProgress: number = 0;
  private pendingAcks: Map<number, (value: void) => void> = new Map(); // 等待ACK的Promise resolvers
  private lastAckedIndex: number = -1; // 最后确认的chunk索引

  // 房间广播模式状态
  private isBroadcastMode: boolean = false;
  private broadcastConnections: Map<string, DataConnection> = new Map(); // deviceId -> connection
  private broadcastPendingAcks: Map<string, Map<number, (value: void) => void>> = new Map(); // deviceId -> (chunkIndex -> resolver)
  private broadcastProgress: Map<string, number> = new Map(); // deviceId -> progress (0-100)
  private broadcastLastAcked: Map<string, number> = new Map(); // deviceId -> lastAckedIndex

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

  // 流式下载状态
  private streamWriter: WritableStreamDefaultWriter | null = null;
  private isStreamingDownload: boolean = false;

  // 传输统计
  private transferStartTime: number = 0;
  private transferredBytes: number = 0;
  private transferTimeout: number | null = null;

  constructor() {
    this.setupEventListeners();
    this.configureStreamSaver();
  }

  /**
   * 配置 StreamSaver
   */
  private configureStreamSaver(): void {
    // 配置 mitm.html 和 sw.js 的路径（在 public 目录）
    if (typeof window !== 'undefined') {
      streamSaver.mitm = '/mitm.html';
    }
  }

  /**
   * 检测是否应该使用流式下载
   * 仅在桌面端且超大文件（>2GB）时使用
   *
   * ⚠️ 重要：移动设备禁用流式下载
   * - 手机性能不足，会导致卡机
   * - StreamSaver的mitm.html在移动端有兼容性问题
   * - 手机用户一般不会传输超大文件
   */
  private shouldUseStreamingDownload(fileSize: number): boolean {
    // 检测移动设备
    const isMobile = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ⚠️ 移动设备禁用流式下载（避免卡机）
    if (isMobile) {
      console.log('[FileTransfer] Mobile device detected - streaming download disabled');
      return false;
    }

    // 仅桌面端且超大文件（>2GB）使用流式下载
    const isVeryLargeFile = fileSize > 2 * 1024 * 1024 * 1024; // 2GB

    // 检查浏览器是否支持 WritableStream
    const supportsStreams = typeof WritableStream !== 'undefined';

    if (isVeryLargeFile && supportsStreams) {
      console.log('[FileTransfer] Desktop + very large file (>2GB) - enabling streaming download');
      return true;
    }

    console.log('[FileTransfer] Using standard download (file size or platform not suitable for streaming)');
    return false;
  }

  /**
   * 初始化流式下载
   * 立即创建下载流，边接收边写入
   */
  private initStreamingDownload(filename: string, fileSize: number): void {
    try {
      console.log(`[FileTransfer] 🚀 Initializing streaming download for ${filename}`);
      console.log(`[FileTransfer] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      // 使用 StreamSaver 创建可写流
      const fileStream = streamSaver.createWriteStream(filename, {
        size: fileSize, // 提供文件大小有助于浏览器显示准确的进度
      });

      this.streamWriter = fileStream.getWriter();

      if (!this.streamWriter) {
        throw new Error('Failed to get stream writer');
      }

      // 立即触发下载对话框/开始下载
      console.log('[FileTransfer] ✅ Download stream created successfully');
      console.log('[FileTransfer] 📥 Browser should now prompt for download location');

      // 通知UI下载已开始（流式）
      eventBus.emit('transfer:download-started', {
        filename: filename,
        streaming: true,
      });

    } catch (error) {
      console.error('[FileTransfer] ❌ Failed to initialize streaming download:', error);
      // 降级到标准下载
      console.warn('[FileTransfer] ⚠️ Falling back to standard download mode');
      this.isStreamingDownload = false;
      this.streamWriter = null;
    }
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听P2P连接数据
    eventBus.on('p2p:connection:data', ({ peer, data }) => {
      this.handleIncomingData(data, peer);
    });

    // 监听连接打开
    eventBus.on('p2p:connection:open', ({ peer, direction }) => {
      if (direction === 'outgoing' && this.currentFile) {
        const conn = p2pManager.getConnection(peer, 'outgoing');
        if (conn) {
          if (this.isBroadcastMode) {
            // 房间模式：收集连接
            this.broadcastConnections.set(peer, conn);
            console.log(`[FileTransferManager] 📡 Room member connected: ${peer} (${this.broadcastConnections.size} total)`);

            // 检查是否所有成员都已连接
            const expectedCount = this.broadcastProgress.size;
            if (this.broadcastConnections.size === expectedCount) {
              console.log('[FileTransferManager] ✅ All room members connected, starting broadcast...');
              this.startBroadcasting();
            }
          } else {
            // 点对点模式
            this.sendConnection = conn;
            this.startSending();
          }
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
   * 向房间成员广播文件
   */
  async sendFileToRoom(memberDeviceIds: string[]): Promise<boolean> {
    if (!this.currentFile) {
      console.error('[FileTransferManager] No file selected');
      return false;
    }

    if (this.isTransferring) {
      console.warn('[FileTransferManager] Transfer already in progress');
      return false;
    }

    if (memberDeviceIds.length === 0) {
      console.warn('[FileTransferManager] No members to send to');
      return false;
    }

    try {
      console.log(`[FileTransferManager] 🏠 Preparing room broadcast: ${this.currentFile.name} to ${memberDeviceIds.length} members`);

      eventBus.emit('transfer:preparing', {
        direction: 'send',
        file: {
          name: this.currentFile.name,
          size: this.currentFile.size,
          type: this.currentFile.type,
        },
      });

      this.isTransferring = true;
      this.isBroadcastMode = true;
      this.transferDirection = 'send';
      this.transferStartTime = Date.now();
      this.transferredBytes = 0;

      // 初始化每个成员的进度跟踪
      memberDeviceIds.forEach(deviceId => {
        this.broadcastProgress.set(deviceId, 0);
        this.broadcastLastAcked.set(deviceId, -1);
        this.broadcastPendingAcks.set(deviceId, new Map());
      });

      // 向所有成员建立P2P连接
      console.log('[FileTransferManager] 📡 Connecting to all room members...');
      memberDeviceIds.forEach(deviceId => {
        p2pManager.connect(deviceId, {
          type: 'file-transfer',
          fileName: this.currentFile!.name,
          fileSize: this.currentFile!.size,
        });
      });

      // 连接建立后会触发 setupEventListeners 中的逻辑
      return true;
    } catch (error) {
      this.handleTransferError(error as Error);
      return false;
    }
  }

  /**
   * 开始房间广播（向多个成员发送文件）
   */
  private async startBroadcasting(): Promise<void> {
    if (this.broadcastConnections.size === 0 || !this.currentFile) return;

    try {
      const file = this.currentFile;

      // 验证文件可读性
      console.log('[FileTransfer] Re-validating file before broadcast...');
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

      console.log(`[FileTransfer] 🏠 Starting room broadcast...`);
      console.log(`[FileTransfer] File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[FileTransfer] Members: ${this.broadcastConnections.size}`);
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

      // 向所有成员发送元数据
      const metadata: ChunkData = {
        type: 'metadata',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks: totalChunks,
      };

      this.broadcastConnections.forEach((conn, deviceId) => {
        try {
          conn.send(metadata);
          console.log(`[FileTransfer] 📤 Metadata sent to ${deviceId}`);
        } catch (error) {
          console.error(`[FileTransfer] Failed to send metadata to ${deviceId}:`, error);
        }
      });

      // 流式读取并广播分块
      for (let i = 0; i < totalChunks; i++) {
        // 读取文件块
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = await this.readFileChunk(file, start, end);

        const chunkData: ChunkData = {
          type: 'chunk',
          index: i,
          data: chunk,
        };

        // 发送给所有成员
        const sendPromises: Promise<void>[] = [];
        this.broadcastConnections.forEach((conn, deviceId) => {
          // 背压控制（每个连接独立检查）
          const waitPromise = this.waitForBufferDrainBroadcast(conn);

          // 发送chunk
          const sendPromise = waitPromise.then(() => {
            try {
              conn.send(chunkData);
            } catch (error) {
              console.error(`[FileTransfer] Failed to send chunk ${i} to ${deviceId}:`, error);
              throw error;
            }
          });

          sendPromises.push(sendPromise);
        });

        // 等待所有发送完成
        await Promise.all(sendPromises);

        // 等待所有成员的ACK
        try {
          await this.waitForAllAcks(i, 10000); // 10秒ACK超时
        } catch (error) {
          console.error(`[FileTransfer] ACK timeout for chunk ${i}:`, error);
          throw error;
        }

        this.transferredBytes += chunk.byteLength;

        // 更新每个成员的进度
        this.broadcastConnections.forEach((_, deviceId) => {
          const lastAcked = this.broadcastLastAcked.get(deviceId) || -1;
          const progress = ((lastAcked + 1) / totalChunks) * 100;
          this.broadcastProgress.set(deviceId, progress);
        });

        // 发送进度更新（每10个chunk或最后一个chunk）
        if (i % 10 === 0 || i === totalChunks - 1) {
          this.emitBroadcastProgress(file.size);
        }

        // 延迟（如果配置了）
        if (sendDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, sendDelay));
        }
      }

      // 向所有成员发送完成标记
      this.broadcastConnections.forEach((conn, deviceId) => {
        try {
          conn.send({ type: 'complete' } as ChunkData);
          console.log(`[FileTransfer] ✅ Complete signal sent to ${deviceId}`);
        } catch (error) {
          console.error(`[FileTransfer] Failed to send complete signal to ${deviceId}:`, error);
        }
      });

      console.log('[FileTransfer] 🎉 Broadcast completed to all members');
      this.clearTransferTimeout();
      this.handleTransferComplete('send');
    } catch (error) {
      this.clearTransferTimeout();
      this.handleTransferError(error as Error);
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
   * 广播模式背压控制：等待单个连接的缓冲区排空
   */
  private async waitForBufferDrainBroadcast(conn: DataConnection): Promise<void> {
    const MAX_BUFFER_SIZE = 4 * 1024 * 1024; // 4MB阈值
    const MAX_WAIT_TIME = 30000; // 30秒超时

    const dataChannel = (conn as any).dataChannel;
    if (!dataChannel) return;

    const startTime = Date.now();
    let lastLogTime = startTime;

    while (dataChannel.bufferedAmount > MAX_BUFFER_SIZE) {
      const elapsed = Date.now() - startTime;

      if (elapsed > MAX_WAIT_TIME) {
        console.error('[FileTransfer] Broadcast buffer drain timeout!', {
          bufferedAmount: dataChannel.bufferedAmount,
          maxBufferSize: MAX_BUFFER_SIZE,
          elapsedTime: elapsed,
        });
        throw new Error('Broadcast buffer drain timeout');
      }

      if (Date.now() - lastLogTime > 5000) {
        console.log('[FileTransfer] Waiting for broadcast buffer drain...', {
          bufferedAmount: (dataChannel.bufferedAmount / 1024 / 1024).toFixed(2) + ' MB',
        });
        lastLogTime = Date.now();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
   * 等待所有成员的ACK确认（广播模式）
   */
  private async waitForAllAcks(chunkIndex: number, timeoutMs: number = 10000): Promise<void> {
    const memberCount = this.broadcastConnections.size;
    let receivedAcks = 0;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 清理所有pending acks
        this.broadcastPendingAcks.forEach((acks) => {
          acks.delete(chunkIndex);
        });
        reject(new Error(`ACK timeout for chunk ${chunkIndex} (received ${receivedAcks}/${memberCount})`));
      }, timeoutMs);

      // 为每个成员注册resolver
      this.broadcastConnections.forEach((_, deviceId) => {
        const memberAcks = this.broadcastPendingAcks.get(deviceId);
        if (memberAcks) {
          memberAcks.set(chunkIndex, () => {
            receivedAcks++;
            // 当所有成员都ACK后，resolve
            if (receivedAcks === memberCount) {
              clearTimeout(timeout);
              // 清理所有pending acks
              this.broadcastPendingAcks.forEach((acks) => {
                acks.delete(chunkIndex);
              });
              resolve();
            }
          });
        }
      });
    });
  }

  /**
   * 处理广播模式的ACK
   */
  private handleBroadcastAck(deviceId: string, chunkIndex: number): void {
    // 更新该成员的lastAcked
    this.broadcastLastAcked.set(deviceId, chunkIndex);

    // 解决等待该ACK的Promise
    const memberAcks = this.broadcastPendingAcks.get(deviceId);
    if (memberAcks) {
      const resolver = memberAcks.get(chunkIndex);
      if (resolver) {
        resolver();
      }
    }
  }

  /**
   * 发送广播进度更新
   */
  private emitBroadcastProgress(totalSize: number): void {
    const elapsed = (Date.now() - this.transferStartTime) / 1000;
    const speed = this.transferredBytes / elapsed;
    const remaining = (totalSize - this.transferredBytes) / speed;

    // 计算总体平均进度
    let totalProgress = 0;
    this.broadcastProgress.forEach((progress) => {
      totalProgress += progress;
    });
    const avgProgress = this.broadcastProgress.size > 0
      ? totalProgress / this.broadcastProgress.size
      : 0;

    // 发送总体进度
    eventBus.emit('transfer:progress', {
      direction: 'send' as TransferDirection,
      progress: Number(avgProgress.toFixed(1)),
      transferred: this.transferredBytes,
      total: totalSize,
      speed: speed,
      remaining: remaining,
      speedMB: (speed / (1024 * 1024)).toFixed(2),
      remainingTime: this.formatTime(remaining),
    });

    // 发送每个成员的进度（用于UI显示）
    const memberProgress: Record<string, number> = {};
    this.broadcastProgress.forEach((progress, deviceId) => {
      memberProgress[deviceId] = Number(progress.toFixed(1));
    });

    eventBus.emit('transfer:broadcast-progress', {
      memberProgress,
      avgProgress: Number(avgProgress.toFixed(1)),
    });
  }

  /**
   * 处理接收数据
   */
  private async handleIncomingData(data: ChunkData, peer?: string): Promise<void> {
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

      // 检测是否使用流式下载
      this.isStreamingDownload = this.shouldUseStreamingDownload(data.size!);

      if (this.isStreamingDownload) {
        console.log('[FileTransfer] ✅ Using streaming download (mobile device or large file)');
        this.initStreamingDownload(data.name!, data.size!);
      } else {
        console.log('[FileTransfer] Using standard download (buffered in memory)');
      }

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
        // 关键修复：必须await，确保流式写入完成
        await this.tryMergeBatch();

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
        if (this.isBroadcastMode && peer) {
          // 广播模式：处理来自特定成员的ACK
          this.handleBroadcastAck(peer, data.ackIndex);
        } else {
          // 点对点模式：处理ACK
          this.handleAck(data.ackIndex);
        }
      }
    } else if (data.type === 'complete') {
      // 接收完成
      console.log('[FileTransfer] Receive completed, assembling file...');
      this.clearTransferTimeout();
      // 关键修复：必须await，确保流关闭完成
      await this.assembleReceivedFile();
    }
  }

  /**
   * 尝试合并批次chunks
   * 检查是否有连续的BATCH_SIZE个chunks可以合并
   * 如果是流式下载，直接写入流；否则缓存在内存
   */
  private async tryMergeBatch(): Promise<void> {
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

        // 流式下载模式：直接写入流
        if (this.isStreamingDownload && this.streamWriter) {
          console.log(`[FileTransfer] 💾 Writing batch ${(batchBlob.size / 1024 / 1024).toFixed(2)} MB to download stream...`);

          try {
            // 转换Blob为Uint8Array并写入流
            const arrayBuffer = await batchBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            await this.streamWriter.write(bytes);

            console.log(`[FileTransfer] ✅ Batch written successfully (chunks ${this.nextBatchIndex} to ${index - 1})`);
          } catch (error) {
            console.error('[FileTransfer] ❌ Failed to write batch to stream:', error);
            throw error;
          }
        } else {
          // 标准模式：缓存在内存
          this.receiveBlobParts.push(batchBlob);
        }

        // 删除已合并的chunks，释放内存
        for (let i = this.nextBatchIndex; i < index; i++) {
          this.receiveChunks.delete(i);
        }

        this.nextBatchIndex = index;

        console.log(`[FileTransfer] 🧹 Memory freed: ${batchChunks.length} chunks, Map size now: ${this.receiveChunks.size}`);
      } catch (error) {
        console.error('[FileTransfer] Failed to merge batch:', error);

        // 如果流式写入失败，降级到标准模式
        if (this.isStreamingDownload) {
          console.warn('[FileTransfer] Streaming failed, falling back to standard download');
          this.isStreamingDownload = false;
          if (this.streamWriter) {
            try {
              await this.streamWriter.abort();
            } catch (e) {
              // ignore
            }
            this.streamWriter = null;
          }
        }
      }
    }
  }

  /**
   * 组装接收的文件（优化内存使用）
   * 流式下载模式：关闭流
   * 标准模式：合并所有blob并触发下载
   */
  private async assembleReceivedFile(): Promise<void> {
    if (!this.receiveMetadata) return;

    try {
      // 流式下载模式：写入剩余chunks并关闭流
      if (this.isStreamingDownload && this.streamWriter) {
        console.log('[FileTransfer] 📦 Finalizing streaming download...');
        console.log(`[FileTransfer] Next batch index: ${this.nextBatchIndex}, Total chunks: ${this.receiveMetadata.totalChunks}`);

        // 写入剩余的chunks
        const remainingChunks: ArrayBuffer[] = [];
        for (let i = this.nextBatchIndex; i < this.receiveMetadata.totalChunks!; i++) {
          const chunk = this.receiveChunks.get(i);
          if (!chunk) {
            console.error(`[FileTransfer] ❌ Missing chunk at index ${i}`);
            throw new Error(`Missing chunk at index ${i}`);
          }
          remainingChunks.push(chunk);
        }

        if (remainingChunks.length > 0) {
          console.log(`[FileTransfer] ✍️ Writing final ${remainingChunks.length} chunks to stream...`);
          const finalBlob = new Blob(remainingChunks, {
            type: this.receiveMetadata.type,
          });
          const arrayBuffer = await finalBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          console.log(`[FileTransfer] Final batch size: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);

          await this.streamWriter.write(bytes);
          console.log('[FileTransfer] ✅ Final batch written successfully');
        } else {
          console.log('[FileTransfer] No remaining chunks to write');
        }

        // 关闭流，完成下载
        console.log('[FileTransfer] 🔒 Closing download stream...');
        await this.streamWriter.close();
        console.log('[FileTransfer] ✅ Stream closed successfully');
        this.streamWriter = null;

        console.log('[FileTransfer] 🎉 Streaming download completed successfully!');
        console.log(`[FileTransfer] File: ${this.receiveMetadata.name} (${(this.receiveMetadata.size / 1024 / 1024).toFixed(2)} MB)`);

        // 清理内存
        this.receiveChunks.clear();
        this.nextBatchIndex = 0;

        // 触发完成事件
        this.handleTransferComplete('receive');

        return;
      }

      // 标准模式：合并所有blob
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

      // 如果是流式下载出错，尝试中止流
      if (this.streamWriter) {
        try {
          await this.streamWriter.abort();
        } catch (e) {
          // ignore
        }
        this.streamWriter = null;
      }

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
  private async reset(): Promise<void> {
    this.clearTransferTimeout();

    // 清理流式下载
    if (this.streamWriter) {
      try {
        await this.streamWriter.abort();
      } catch (e) {
        // ignore
      }
      this.streamWriter = null;
    }
    this.isStreamingDownload = false;

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

    // 清理广播模式状态
    this.isBroadcastMode = false;
    this.broadcastConnections.clear();
    this.broadcastPendingAcks.clear();
    this.broadcastProgress.clear();
    this.broadcastLastAcked.clear();
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
