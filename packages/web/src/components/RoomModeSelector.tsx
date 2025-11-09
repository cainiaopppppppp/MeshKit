/**
 * RoomModeSelector - 传输模式选择器
 * 点对点模式 vs 房间模式
 */
import { useAppStore } from '../store';
import { fileTransferManager } from '@meshkit/core';

export function RoomModeSelector() {
  const { transferMode, setTransferMode, isTransferring, reset, resetRoom } = useAppStore();

  const handleModeChange = (mode: 'p2p' | 'room') => {
    if (isTransferring) return; // 传输中不允许切换

    // 切换模式时清空文件选择和状态
    fileTransferManager.fullReset();

    // 根据当前模式调用相应的reset
    if (transferMode === 'room') {
      resetRoom(); // 从房间模式切换出来，重置房间状态
    } else {
      reset(); // 从点对点模式切换出来，重置点对点状态
    }

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
          <span className="mode-icon">🎫</span>
          <span className="mode-label">取件码模式</span>
        </button>
      </div>

      <div className="mode-description">
        {transferMode === 'p2p' ? (
          <p className="description-text">
            选择一个设备，直接发送文件
          </p>
        ) : (
          <p className="description-text">
            通过取件码发送或接收文件，支持多人同时接收
          </p>
        )}
      </div>
    </div>
  );
}
