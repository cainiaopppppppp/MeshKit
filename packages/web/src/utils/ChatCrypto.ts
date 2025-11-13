/**
 * 加密聊天 - 端到端加密工具
 * 使用 crypto-js 实现（和便利墙一样），支持多种加密算法
 */

import CryptoJS from 'crypto-js';
import { KeyPair } from '../types/chat';

export type EncryptionMethod = 'AES-256-CBC' | 'AES-256-GCM' | 'TripleDES' | 'Rabbit' | 'RC4';

export const ENCRYPTION_METHODS = [
  { value: 'AES-256-CBC', label: 'AES-256-CBC (推荐)', description: '安全性高，速度快' },
  { value: 'AES-256-GCM', label: 'AES-256-GCM (最安全)', description: '带认证的加密，最安全但稍慢' },
  { value: 'TripleDES', label: 'TripleDES', description: '向后兼容，安全性中等' },
  { value: 'Rabbit', label: 'Rabbit', description: '速度极快，安全性高' },
  { value: 'RC4', label: 'RC4', description: '速度快，但安全性较低（不推荐）' },
] as const;

class ChatCrypto {
  /**
   * 初始化（crypto-js 是纯 JS，不需要异步初始化）
   */
  async init(): Promise<void> {
    console.log('[ChatCrypto] Initialized with crypto-js');
  }

  /**
   * 哈希密码（用于密码验证）
   */
  hashPassword(password: string): string {
    const hash = CryptoJS.SHA256(password);
    return hash.toString(CryptoJS.enc.Hex);
  }

  /**
   * 加密消息
   * @param message 明文消息
   * @param password 密码
   * @param method 加密方法
   */
  encrypt(message: string, password: string, method: EncryptionMethod = 'AES-256-CBC'): string {
    try {
      let result: string;

      switch (method) {
        case 'AES-256-CBC':
          result = CryptoJS.AES.encrypt(message, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }).toString();
          break;

        case 'AES-256-GCM':
          // crypto-js 不直接支持 GCM，使用 CBC + HMAC 模拟认证加密
          const encryptedText = CryptoJS.AES.encrypt(message, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }).toString();
          const hmac = CryptoJS.HmacSHA256(encryptedText, password).toString();
          // 格式: ciphertext|hmac
          result = encryptedText + '|' + hmac;
          break;

        case 'TripleDES':
          result = CryptoJS.TripleDES.encrypt(message, password).toString();
          break;

        case 'Rabbit':
          result = CryptoJS.Rabbit.encrypt(message, password).toString();
          break;

        case 'RC4':
          result = CryptoJS.RC4.encrypt(message, password).toString();
          break;

        default:
          throw new Error(`不支持的加密方法: ${method}`);
      }

      return result;
    } catch (error) {
      console.error('[ChatCrypto] Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * 解密消息
   * @param encryptedMessage 加密的消息
   * @param password 密码
   * @param method 加密方法
   */
  decrypt(encryptedMessage: string, password: string, method: EncryptionMethod = 'AES-256-CBC'): string {
    try {
      let decrypted: CryptoJS.lib.WordArray;

      switch (method) {
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(encryptedMessage, password);
          break;

        case 'AES-256-GCM':
          // 验证 HMAC 并解密
          const parts = encryptedMessage.split('|');
          if (parts.length !== 2) {
            throw new Error('Invalid encrypted format');
          }
          const [ciphertext, receivedHmac] = parts;
          const computedHmac = CryptoJS.HmacSHA256(ciphertext, password).toString();
          if (computedHmac !== receivedHmac) {
            throw new Error('HMAC verification failed - data may be tampered');
          }
          decrypted = CryptoJS.AES.decrypt(ciphertext, password);
          break;

        case 'TripleDES':
          decrypted = CryptoJS.TripleDES.decrypt(encryptedMessage, password);
          break;

        case 'Rabbit':
          decrypted = CryptoJS.Rabbit.decrypt(encryptedMessage, password);
          break;

        case 'RC4':
          decrypted = CryptoJS.RC4.decrypt(encryptedMessage, password);
          break;

        default:
          throw new Error(`不支持的加密方法: ${method}`);
      }

      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plaintext) {
        throw new Error('解密失败：密码错误');
      }

      return plaintext;
    } catch (error) {
      console.error('[ChatCrypto] Decryption failed:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * 生成密钥对（用于用户ID）
   * 现在只用于生成唯一的用户ID
   */
  generateKeyPair(): KeyPair {
    // 生成随机的用户ID
    const randomBytes = CryptoJS.lib.WordArray.random(32);
    const publicKeyHex = randomBytes.toString(CryptoJS.enc.Hex);

    // 为了兼容性，保留 publicKey 和 privateKey 字段（但实际不使用）
    const publicKey = this.hexToBytes(publicKeyHex);
    const privateKey = this.hexToBytes(publicKeyHex); // 对称加密不需要私钥

    console.log('[ChatCrypto] Generated new user ID:', publicKeyHex);

    return {
      publicKey,
      privateKey,
      publicKeyHex,
    };
  }

  /**
   * 生成随机 ID
   */
  generateRandomId(): string {
    const randomBytes = CryptoJS.lib.WordArray.random(16);
    return randomBytes.toString(CryptoJS.enc.Hex);
  }

  /**
   * 将十六进制字符串转换为 Uint8Array
   */
  hexToBytes(hex: string): Uint8Array {
    const wordArray = CryptoJS.enc.Hex.parse(hex);
    const bytes = new Uint8Array(wordArray.words.length * 4);
    for (let i = 0; i < wordArray.words.length; i++) {
      const word = wordArray.words[i];
      bytes[i * 4] = (word >> 24) & 0xff;
      bytes[i * 4 + 1] = (word >> 16) & 0xff;
      bytes[i * 4 + 2] = (word >> 8) & 0xff;
      bytes[i * 4 + 3] = word & 0xff;
    }
    return bytes;
  }

  /**
   * 将 Uint8Array 转换为 Base64
   */
  toBase64(data: Uint8Array): string {
    const wordArray = CryptoJS.lib.WordArray.create(Array.from(data) as any);
    return CryptoJS.enc.Base64.stringify(wordArray);
  }

  /**
   * 从 Base64 转换为 Uint8Array
   */
  fromBase64(base64: string): Uint8Array {
    const wordArray = CryptoJS.enc.Base64.parse(base64);
    const bytes = new Uint8Array(wordArray.words.length * 4);
    for (let i = 0; i < wordArray.words.length; i++) {
      const word = wordArray.words[i];
      bytes[i * 4] = (word >> 24) & 0xff;
      bytes[i * 4 + 1] = (word >> 16) & 0xff;
      bytes[i * 4 + 2] = (word >> 8) & 0xff;
      bytes[i * 4 + 3] = word & 0xff;
    }
    return bytes;
  }
}

// 导出单例
export const chatCrypto = new ChatCrypto();
