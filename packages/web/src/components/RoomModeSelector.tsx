/**
 * RoomModeSelector - 传输模式选择器
 * 点对点模式 vs 房间模式
 */
import { useAppStore } from '../store';

export function RoomModeSelector() {
  const { transferMode, setTransferMode, isTransferring } = useAppStore();

  const handleModeChange = (mode: 'p2p' | 'room') => {
    if (isTransferring) return; // 传输中不允许切换
    setTransferMode(mode);
  };

  return (
    <div className="mode-selector">
      <div className="mode-tabs">
        <button
          className={`mode-tab ${transferMode === 'p2p' ? 'active' : ''}`}
          onClick={() => handleModeChange('p2p')}
          disabled={isTransferring}
        >
          <span className="mode-icon">🔗</span>
          <span className="mode-label">点对点传输</span>
        </button>

        <button
          className={`mode-tab ${transferMode === 'room' ? 'active' : ''}`}
          onClick={() => handleModeChange('room')}
          disabled={isTransferring}
        >
          <span className="mode-icon">🏠</span>
          <span className="mode-label">房间模式</span>
        </button>
      </div>

      <div className="mode-description">
        {transferMode === 'p2p' ? (
          <p className="description-text">
            选择一个设备，直接发送文件
          </p>
        ) : (
          <p className="description-text">
            创建房间或加入房间，同时向多人传输文件
          </p>
        )}
      </div>
    </div>
  );
}
