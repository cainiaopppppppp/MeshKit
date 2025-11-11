/**
 * 便签墙 - 端到端加密工具 (可选)
 */

export class EncryptionHelper {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  /**
   * 从密码派生加密密钥
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密文本
   */
  async encrypt(text: string, password: string): Promise<string> {
    try {
      // 生成随机盐和 IV
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 派生密钥
      const key = await this.deriveKey(password, salt);

      // 加密数据
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        this.encoder.encode(text)
      );

      // 组合: salt(16) + iv(12) + encrypted
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      // 转换为 Base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * 解密文本
   */
  async decrypt(encryptedText: string, password: string): Promise<string> {
    try {
      // 从 Base64 解码
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

      // 提取 salt, iv 和加密数据
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);

      // 派生密钥
      const key = await this.deriveKey(password, salt);

      // 解密数据
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      return this.decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data - wrong password?');
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
