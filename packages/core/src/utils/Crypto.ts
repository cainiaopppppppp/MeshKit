/**
 * 密码保护工具类
 * 使用 Web Crypto API 进行密码哈希和验证
 */

/**
 * 生成密码哈希（用于验证）
 * 使用相同的 PBKDF2 过程，但只取哈希值
 */
export async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    256 // 256 bits
  );

  // 转换为 Base64
  return arrayBufferToBase64(hashBuffer);
}

/**
 * 生成密码保护信息
 * 返回盐值和密码哈希
 */
export async function generatePasswordProtection(password: string): Promise<{
  salt: string; // Base64
  passwordHash: string; // Base64
}> {
  // 生成随机盐值
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 生成密码哈希
  const passwordHash = await hashPassword(password, salt);

  return {
    salt: arrayBufferToBase64(salt),
    passwordHash,
  };
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  salt: string, // Base64
  expectedHash: string // Base64
): Promise<boolean> {
  const saltBuffer = base64ToArrayBuffer(salt);
  const actualHash = await hashPassword(password, new Uint8Array(saltBuffer));
  return actualHash === expectedHash;
}

/**
 * ArrayBuffer 转 Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 转 ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

