import { fileTransferManager } from '@meshkit/core';
import { usePickupHostNavigationGuard } from '../hooks/usePickupHostNavigationGuard';
import { useAppStore } from '../store';

type TransferView = 'p2p' | 'room-send' | 'room-receive';

export function RoomModeSelector() {
  const {
    transferMode,
    mode,
    setTransferMode,
    setMode,
    isTransferring,
    reset,
    resetRoom,
  } = useAppStore();
  const { guardTransferViewChange } = usePickupHostNavigationGuard('/');

  const handleViewChange = (view: TransferView) => {
    if (!guardTransferViewChange(view)) {
      return;
    }

    if (isTransferring) {
      return;
    }

    fileTransferManager.fullReset();

    if (transferMode === 'room') {
      resetRoom();
    } else {
      reset();
    }

    if (view === 'p2p') {
      setTransferMode('p2p');
      setMode('send');
      return;
    }

    setTransferMode('room');
    setMode(view === 'room-send' ? 'send' : 'receive');
  };

  const p2pActive = transferMode === 'p2p';
  const roomSendActive = transferMode === 'room' && mode === 'send';
  const roomReceiveActive = transferMode === 'room' && mode === 'receive';

  const getButtonClasses = (active: boolean) => (
    `rounded-[10px] px-3 py-3 text-[13px] font-medium transition ${
      active
        ? 'bg-[#f8fafd] text-[#1a6dff] shadow-[0_1px_3px_rgba(26,31,54,0.04)]'
        : 'text-[#5e6687] hover:bg-[#f8fafd]'
    }`
  );

  return (
    <div className="grid grid-cols-3 gap-1">
      <button
        type="button"
        className={getButtonClasses(p2pActive)}
        onClick={() => handleViewChange('p2p')}
      >
        点对点传输
      </button>

      <button
        type="button"
        className={getButtonClasses(roomSendActive)}
        onClick={() => handleViewChange('room-send')}
      >
        生成取件码
      </button>

      <button
        type="button"
        className={getButtonClasses(roomReceiveActive)}
        onClick={() => handleViewChange('room-receive')}
      >
        输入取件码
      </button>
    </div>
  );
}
