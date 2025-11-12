/**
 * 便签墙 - 端到端加密工具 (可选)
 * 使用 crypto-js 实现，支持 HTTP 环境和多种加密算法
 */

import CryptoJS from 'crypto-js';

export type EncryptionMethod = 'AES-256-CBC' | 'AES-256-GCM' | 'TripleDES' | 'Rabbit' | 'RC4';

export const ENCRYPTION_METHODS = [
  { value: 'AES-256-CBC', label: 'AES-256-CBC (推荐)', description: '安全性高，速度快' },
  { value: 'AES-256-GCM', label: 'AES-256-GCM (最安全)', description: '带认证的加密，最安全但稍慢' },
  { value: 'TripleDES', label: 'TripleDES', description: '向后兼容，安全性中等' },
  { value: 'Rabbit', label: 'Rabbit', description: '速度极快，安全性高' },
  { value: 'RC4', label: 'RC4', description: '速度快，但安全性较低（不推荐）' },
] as const;

// 验证token，用于验证密码正确性
const VERIFICATION_TOKEN = '__VERIFY_PASSWORD__';

export class EncryptionHelper {
  /**
   * 检查加密 API 是否可用
   * crypto-js 是纯 JavaScript 实现，在任何环境下都可用
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * 创建验证token
   * 用于验证密码是否正确
   */
  async createVerificationToken(password: string, method: EncryptionMethod = 'AES-256-CBC'): Promise<string> {
    return await this.encrypt(VERIFICATION_TOKEN, password, method);
  }

  /**
   * 验证密码是否正确
   */
  async verifyPassword(encryptedToken: string, password: string, method: EncryptionMethod = 'AES-256-CBC'): Promise<boolean> {
    try {
      const decrypted = await this.decrypt(encryptedToken, password, method);
      return decrypted === VERIFICATION_TOKEN;
    } catch {
      return false;
    }
  }

  /**
   * 加密文本
   * @param text 要加密的文本
   * @param password 密码
   * @param method 加密方法
   */
  async encrypt(text: string, password: string, method: EncryptionMethod = 'AES-256-CBC'): Promise<string> {
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
          // crypto-js 不直接支持 GCM，使用 CBC + HMAC 模拟认证加密
          const encryptedText = CryptoJS.AES.encrypt(text, password, {
            keySize: 256 / 32,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }).toString();
          const hmac = CryptoJS.HmacSHA256(encryptedText, password).toString();
          // 格式: ciphertext|hmac
          result = encryptedText + '|' + hmac;
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
          throw new Error(`不支持的加密方法: ${method}`);
      }

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('加密失败：' + (error as Error).message);
    }
  }

  /**
   * 解密文本
   * @param encryptedText 加密的文本
   * @param password 密码
   * @param method 加密方法
   */
  async decrypt(encryptedText: string, password: string, method: EncryptionMethod = 'AES-256-CBC'): Promise<string> {
    try {
      let decrypted: CryptoJS.lib.WordArray;

      switch (method) {
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(encryptedText, password);
          break;

        case 'AES-256-GCM':
          // 验证 HMAC 并解密
          const parts = encryptedText.split('|');
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
          decrypted = CryptoJS.TripleDES.decrypt(encryptedText, password);
          break;

        case 'Rabbit':
          decrypted = CryptoJS.Rabbit.decrypt(encryptedText, password);
          break;

        case 'RC4':
          decrypted = CryptoJS.RC4.decrypt(encryptedText, password);
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
      console.error('Decryption error:', error);
      throw new Error('解密失败：密码错误或数据损坏');
    }
  }

  /**
   * 生成随机颜色（用于用户标识）
   */
  generateRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E76F51', '#2A9D8F'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const encryptionHelper = new EncryptionHelper();
