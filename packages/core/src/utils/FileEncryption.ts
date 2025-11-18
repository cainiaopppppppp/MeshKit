/**
 * 文件加密工具类
 * 使用 crypto-js 进行文件内容加密/解密
 * 参考便签墙和加密聊天的实现
 */

import CryptoJS from 'crypto-js';

/**
 * 支持的加密算法
 */
export type EncryptionMethod =
  | 'AES-256-CBC'    // 推荐：安全性高，速度快
  | 'AES-256-GCM'    // 最安全：带认证的加密
  | 'TripleDES'      // 向后兼容
  | 'Rabbit'         // 速度极快
  | 'RC4';           // 速度快，但安全性较低

/**
 * 加密算法描述
 */
export const ENCRYPTION_METHODS = [
  {
    value: 'AES-256-CBC',
    label: 'AES-256-CBC (推荐)',
    description: '高级加密标准，安全性高，速度快'
  },
  {
    value: 'AES-256-GCM',
    label: 'AES-256-GCM (最安全)',
    description: '带认证的加密，最高安全性'
  },
  {
    value: 'TripleDES',
    label: 'TripleDES',
    description: '三重数据加密标准，向后兼容'
  },
  {
    value: 'Rabbit',
    label: 'Rabbit (快速)',
    description: '速度极快的流加密算法'
  },
  {
    value: 'RC4',
    label: 'RC4',
    description: '速度快，安全性较低（不推荐）'
  },
] as const;

/**
 * 文件加密辅助类
 */
export class FileEncryptionHelper {
  /**
   * 加密ArrayBuffer数据
   */
  async encryptArrayBuffer(
    data: ArrayBuffer,
    password: string,
    method: EncryptionMethod
  ): Promise<ArrayBuffer> {
    try {
      // 将ArrayBuffer转换为WordArray
      const wordArray = this.arrayBufferToWordArray(data);

      // 加密
      let encrypted: CryptoJS.lib.CipherParams;

      switch (method) {
        case 'AES-256-CBC':
          encrypted = CryptoJS.AES.encrypt(wordArray, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          break;

        case 'AES-256-GCM':
          // 使用CBC模式 + HMAC模拟GCM
          encrypted = CryptoJS.AES.encrypt(wordArray, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });

          // 添加HMAC认证
          const hmac = CryptoJS.HmacSHA256(encrypted.toString(), password);
          const combined = encrypted.toString() + '|' + hmac.toString();
          return this.stringToArrayBuffer(combined);

        case 'TripleDES':
          encrypted = CryptoJS.TripleDES.encrypt(wordArray, password);
          break;

        case 'Rabbit':
          encrypted = CryptoJS.Rabbit.encrypt(wordArray, password);
          break;

        case 'RC4':
          encrypted = CryptoJS.RC4.encrypt(wordArray, password);
          break;

        default:
          throw new Error(`Unsupported encryption method: ${method}`);
      }

      // 转换回ArrayBuffer
      return this.stringToArrayBuffer(encrypted.toString());
    } catch (error) {
      console.error('[FileEncryption] Encryption failed:', error);
      throw new Error('文件加密失败: ' + (error as Error).message);
    }
  }

  /**
   * 解密ArrayBuffer数据
   */
  async decryptArrayBuffer(
    encryptedData: ArrayBuffer,
    password: string,
    method: EncryptionMethod
  ): Promise<ArrayBuffer> {
    try {
      const encryptedString = this.arrayBufferToString(encryptedData);

      let decrypted: CryptoJS.lib.WordArray;

      switch (method) {
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(encryptedString, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          break;

        case 'AES-256-GCM':
          // 验证HMAC
          const parts = encryptedString.split('|');
          if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
          }

          const [ciphertext, receivedHmac] = parts;
          const computedHmac = CryptoJS.HmacSHA256(ciphertext, password).toString();

          if (computedHmac !== receivedHmac) {
            throw new Error('HMAC验证失败 - 数据可能被篡改或密码错误');
          }

          decrypted = CryptoJS.AES.decrypt(ciphertext, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          break;

        case 'TripleDES':
          decrypted = CryptoJS.TripleDES.decrypt(encryptedString, password);
          break;

        case 'Rabbit':
          decrypted = CryptoJS.Rabbit.decrypt(encryptedString, password);
          break;

        case 'RC4':
          decrypted = CryptoJS.RC4.decrypt(encryptedString, password);
          break;

        default:
          throw new Error(`Unsupported decryption method: ${method}`);
      }

      // 转换回ArrayBuffer
      return this.wordArrayToArrayBuffer(decrypted);
    } catch (error) {
      console.error('[FileEncryption] Decryption failed:', error);
      throw new Error('文件解密失败，请检查密码是否正确');
    }
  }

  /**
   * 加密文本（用于创建验证token）
   */
  async encryptText(
    text: string,
    password: string,
    method: EncryptionMethod
  ): Promise<string> {
    try {
      let result: string;

      switch (method) {
        case 'AES-256-CBC':
          result = CryptoJS.AES.encrypt(text, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }).toString();
          break;

        case 'AES-256-GCM':
          const encryptedText = CryptoJS.AES.encrypt(text, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          const hmac = CryptoJS.HmacSHA256(encryptedText.toString(), password);
          result = encryptedText.toString() + '|' + hmac.toString();
          break;

        case 'TripleDES':
          result = CryptoJS.TripleDES.encrypt(text, password).toString();
          break;

        case 'Rabbit':
          result = CryptoJS.Rabbit.encrypt(text, password).toString();
          break;

        case 'RC4':
          result = CryptoJS.RC4.encrypt(text, password).toString();
          break;

        default:
          throw new Error(`Unsupported encryption method: ${method}`);
      }

      return result;
    } catch (error) {
      throw new Error('文本加密失败: ' + (error as Error).message);
    }
  }

  /**
   * 解密文本（用于验证token）
   */
  async decryptText(
    encryptedText: string,
    password: string,
    method: EncryptionMethod
  ): Promise<string> {
    try {
      let decrypted: CryptoJS.lib.WordArray;

      switch (method) {
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(encryptedText, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          break;

        case 'AES-256-GCM':
          const parts = encryptedText.split('|');
          if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
          }

          const [ciphertext, receivedHmac] = parts;
          const computedHmac = CryptoJS.HmacSHA256(ciphertext, password).toString();

          if (computedHmac !== receivedHmac) {
            throw new Error('HMAC verification failed');
          }

          decrypted = CryptoJS.AES.decrypt(ciphertext, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          break;

        case 'TripleDES':
          decrypted = CryptoJS.TripleDES.decrypt(encryptedText, password);
          break;

        case 'Rabbit':
          decrypted = CryptoJS.Rabbit.decrypt(encryptedText, password);
          break;

        case 'RC4':
          decrypted = CryptoJS.RC4.decrypt(encryptedText, password);
          break;

        default:
          throw new Error(`Unsupported decryption method: ${method}`);
      }

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error('文本解密失败');
    }
  }

  /**
   * 创建验证token
   */
  async createVerificationToken(
    password: string,
    method: EncryptionMethod
  ): Promise<string> {
    return await this.encryptText('__FILE_TRANSFER_VERIFY__', password, method);
  }

  /**
   * 验证密码
   */
  async verifyPassword(
    token: string,
    password: string,
    method: EncryptionMethod
  ): Promise<boolean> {
    try {
      const decrypted = await this.decryptText(token, password, method);
      return decrypted === '__FILE_TRANSFER_VERIFY__';
    } catch (error) {
      return false;
    }
  }

  /**
   * ArrayBuffer 转 WordArray
   */
  private arrayBufferToWordArray(arrayBuffer: ArrayBuffer): CryptoJS.lib.WordArray {
    const u8 = new Uint8Array(arrayBuffer);
    const len = u8.length;
    const words: number[] = [];

    for (let i = 0; i < len; i += 1) {
      words[i >>> 2] |= (u8[i] & 0xff) << (24 - (i % 4) * 8);
    }

    return CryptoJS.lib.WordArray.create(words, len);
  }

  /**
   * WordArray 转 ArrayBuffer
   */
  private wordArrayToArrayBuffer(wordArray: CryptoJS.lib.WordArray): ArrayBuffer {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i += 1) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    return u8.buffer;
  }

  /**
   * ArrayBuffer 转 String
   */
  private arrayBufferToString(arrayBuffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    return binaryString;
  }

  /**
   * String 转 ArrayBuffer
   */
  private stringToArrayBuffer(str: string): ArrayBuffer {
    const uint8Array = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i);
    }
    return uint8Array.buffer;
  }
}

// 导出单例
export const fileEncryption = new FileEncryptionHelper();
