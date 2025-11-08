/**
 * RoomContainer - 房间模式容器
 * 根据状态显示不同的界面：创建房间、加入房间或房间内部
 */
import { useState } from 'react';
import { useAppStore } from '../store';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { RoomView } from './RoomView';

type RoomViewType = 'select' | 'create' | 'join';

export function RoomContainer() {
  const { currentRoom } = useAppStore();
  const [viewType, setViewType] = useState<RoomViewType>('select');

  // 如果已经在房间内，直接显示房间界面
  if (currentRoom) {
    return <RoomView />;
  }

  // 否则显示选择界面
  return (
    <div className="room-container">
      {viewType === 'select' && (
        <div className="room-select">
          <h2 className="main-title">🏠 房间模式</h2>
          <p className="subtitle">选择创建新房间或加入现有房间</p>

          <div className="action-buttons">
            <button
              className="action-button create"
              onClick={() => setViewType('create')}
            >
              <span className="button-icon">➕</span>
              <span className="button-text">创建房间</span>
              <span className="button-desc">分享文件给多人</span>
            </button>

            <button
              className="action-button join"
              onClick={() => setViewType('join')}
            >
              <span className="button-icon">🔑</span>
              <span className="button-text">加入房间</span>
              <span className="button-desc">接收他人分享的文件</span>
            </button>
          </div>
        </div>
      )}

      {viewType === 'create' && (
        <div className="room-form">
          <button
            className="back-button"
            onClick={() => setViewType('select')}
          >
            ← 返回
          </button>
          <CreateRoom />
        </div>
      )}

      {viewType === 'join' && (
        <div className="room-form">
          <button
            className="back-button"
            onClick={() => setViewType('select')}
          >
            ← 返回
          </button>
          <JoinRoom />
        </div>
      )}
    </div>
  );
}
