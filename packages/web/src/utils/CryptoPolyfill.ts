/**
 * Crypto API Polyfill for y-webrtc
 * y-webrtc 在某些环境下可能找不到 crypto.subtle API
 */

// 确保 crypto.subtle 存在（即使是一个空实现）
if (typeof window !== 'undefined' && !window.crypto?.subtle) {
  console.warn('[CryptoPolyfill] crypto.subtle not available, providing stub implementation');

  // 创建一个基础的 stub 实现
  if (!window.crypto) {
    (window as any).crypto = {};
  }

  if (!(window.crypto as any).subtle) {
    (window.crypto as any).subtle = {
      importKey: () => Promise.reject(new Error('Crypto not supported')),
      deriveKey: () => Promise.reject(new Error('Crypto not supported')),
      deriveBits: () => Promise.reject(new Error('Crypto not supported')),
      encrypt: () => Promise.reject(new Error('Crypto not supported')),
      decrypt: () => Promise.reject(new Error('Crypto not supported')),
      sign: () => Promise.reject(new Error('Crypto not supported')),
      verify: () => Promise.reject(new Error('Crypto not supported')),
      digest: () => Promise.reject(new Error('Crypto not supported')),
      generateKey: () => Promise.reject(new Error('Crypto not supported')),
      wrapKey: () => Promise.reject(new Error('Crypto not supported')),
      unwrapKey: () => Promise.reject(new Error('Crypto not supported')),
      exportKey: () => Promise.reject(new Error('Crypto not supported')),
    };
  }
}

export {};
