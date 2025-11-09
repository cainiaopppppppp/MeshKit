/**
 * JoinRoom - 输入取件码界面
 */
import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';

export function JoinRoom() {
  const { joinRoom, isJoining, error } = useRoom();
  const [code, setCode] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // 只允许数字，最多6位
    setCode(value);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      alert('请输入6位取件码');
      return;
    }

    await joinRoom(code);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleJoin();
    }
  };

  return (
    <div className="join-room">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">输入取件码</h3>
        <p className="text-gray-600">请输入对方分享的6位取件码</p>
      </div>

      <div className="mb-6">
        <input
          id="code-input"
          type="text"
          className="w-full text-center text-4xl font-bold tracking-widest py-4 px-6 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
          value={code}
          onChange={handleCodeChange}
          onKeyPress={handleKeyPress}
          placeholder="000000"
          maxLength={6}
          autoComplete="off"
          autoFocus
        />
        <div className="text-center mt-3">
          {code.length > 0 && code.length < 6 && (
            <span className="text-sm text-gray-500">还需输入 {6 - code.length} 位数字</span>
          )}
          {code.length === 6 && (
            <span className="text-sm text-green-600 font-semibold">✓ 取件码已输入完整</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          ❌ {error}
        </div>
      )}

      <button
        className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white text-lg font-bold rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        onClick={handleJoin}
        disabled={code.length !== 6 || isJoining}
      >
        {isJoining ? ' 连接中...' : ' 开始接收文件'}
      </button>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 text-center">
           连接成功后，可以选择要接收的文件
        </p>
        <p className="text-sm text-gray-600 text-center mt-1">
           确保与发送方网络互通
        </p>
      </div>
    </div>
  );
}
