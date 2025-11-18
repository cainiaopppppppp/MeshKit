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
    <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
      <button
        className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-2 ${
          transferMode === 'p2p'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:bg-white/50'
        }`}
        onClick={() => handleModeChange('p2p')}
        disabled={isTransferring}
      >
        <span>🔗</span>
        <span>点对点传输</span>
      </button>

      <button
        className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-2 ${
          transferMode === 'room'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:bg-white/50'
        }`}
        onClick={() => handleModeChange('room')}
        disabled={isTransferring}
      >
        <span>🎫</span>
        <span>取件码模式</span>
      </button>
    </div>
  );
}
