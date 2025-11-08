/**
 * JoinRoom - 加入房间界面
 */
import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';

export function JoinRoom() {
  const { joinRoom, isJoining, error } = useRoom();
  const [roomId, setRoomId] = useState('');

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // 只允许数字，最多6位
    setRoomId(value);
  };

  const handleJoinRoom = async () => {
    if (roomId.length !== 6) {
      alert('请输入6位房间号');
      return;
    }

    await joinRoom(roomId);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && roomId.length === 6) {
      handleJoinRoom();
    }
  };

  return (
    <div className="join-room">
      <h3 className="section-title">📥 加入传输房间</h3>

      <div className="room-id-input-group">
        <label htmlFor="room-id-input" className="input-label">
          房间号
        </label>
        <input
          id="room-id-input"
          type="text"
          className="room-id-input"
          value={roomId}
          onChange={handleRoomIdChange}
          onKeyPress={handleKeyPress}
          placeholder="输入6位房间号"
          maxLength={6}
          autoComplete="off"
        />
        <div className="input-hint">
          {roomId.length > 0 && roomId.length < 6 && (
            <span className="hint-text">还需输入 {6 - roomId.length} 位</span>
          )}
          {roomId.length === 6 && (
            <span className="hint-text success">✓ 可以加入</span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <button
        className="join-room-button"
        onClick={handleJoinRoom}
        disabled={roomId.length !== 6 || isJoining}
      >
        {isJoining ? '加入中...' : '加入房间'}
      </button>

      <div className="info-text">
        <p>💡 输入房间号后，可以接收房主分享的文件</p>
        <p>📡 确保与房主在同一局域网内</p>
      </div>
    </div>
  );
}
