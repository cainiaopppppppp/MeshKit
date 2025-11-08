/**
 * FileStorage - IndexedDB 文件存储工具
 * 用于持久化接收到的文件，支持页面刷新后恢复
 */

interface StoredFile {
  id: string;
  filename: string;
  type: string;
  size: number;
  blob: Blob;
  receivedAt: number;
}

const DB_NAME = 'meshkit_files';
const DB_VERSION = 1;
const STORE_NAME = 'received_files';

class FileStorage {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[FileStorage] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[FileStorage] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('filename', 'filename', { unique: false });
          objectStore.createIndex('receivedAt', 'receivedAt', { unique: false });
          console.log('[FileStorage] Object store created');
        }
      };
    });
  }

  /**
   * 保存文件
   */
  async saveFile(file: File): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const storedFile: StoredFile = {
      id,
      filename: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      receivedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(storedFile);

      request.onsuccess = () => {
        console.log('[FileStorage] File saved:', id, file.name);
        resolve(id);
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to save file:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取最近接收的文件
   */
  async getLatestFile(): Promise<StoredFile | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('receivedAt');

      // 获取最新的一个文件
      const request = index.openCursor(null, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve(cursor.value as StoredFile);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to get latest file:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取文件
   */
  async getFile(id: string): Promise<StoredFile | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to get file:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有文件
   */
  async getAllFiles(): Promise<StoredFile[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to get all files:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除文件
   */
  async deleteFile(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        console.log('[FileStorage] File deleted:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to delete file:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有文件
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('[FileStorage] All files cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to clear files:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清理过期文件（超过7天的文件）
   */
  async cleanupOldFiles(maxAgeDays: number = 7): Promise<number> {
    if (!this.db) {
      await this.init();
    }

    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('receivedAt');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log('[FileStorage] Cleaned up old files:', deletedCount);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[FileStorage] Failed to cleanup old files:', request.error);
        reject(request.error);
      };
    });
  }
}

// 导出单例
export const fileStorage = new FileStorage();
export default FileStorage;
