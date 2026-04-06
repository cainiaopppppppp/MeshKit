import { fileTransferManager } from '@meshkit/core';
import { useAppStore } from '../store';

function DirectTransferIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="8" r="2.25" />
      <circle cx="6" cy="16" r="2.25" />
      <circle cx="18" cy="12" r="2.25" />
      <path d="M8.25 8h5.25" />
      <path d="M8.25 16h5.25" />
      <path d="m12.5 9.75 3.25 2.25-3.25 2.25" />
    </svg>
  );
}

function PickupCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 8a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 8v1.25a1.75 1.75 0 0 0 0 3.5V14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 14v-1.25a1.75 1.75 0 0 0 0-3.5V8Z" />
      <path d="M10 9.5h4" />
      <path d="M9 13.5h1" />
      <path d="M12 13.5h1" />
      <path d="M15 13.5h1" />
    </svg>
  );
}

export function RoomModeSelector() {
  const { transferMode, setTransferMode, isTransferring, reset, resetRoom } = useAppStore();

  const handleModeChange = (mode: 'p2p' | 'room') => {
    if (isTransferring) return;

    fileTransferManager.fullReset();

    if (transferMode === 'room') {
      resetRoom();
    } else {
      reset();
    }

    setTransferMode(mode);
  };

  return (
    <div className="flex gap-2 rounded-lg bg-gray-50 p-1">
      <button
        className={`group flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          transferMode === 'p2p'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:bg-white/50'
        }`}
        onClick={() => handleModeChange('p2p')}
        disabled={isTransferring}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
            transferMode === 'p2p'
              ? 'border-blue-200 bg-blue-50 text-blue-600'
              : 'border-gray-200 bg-white text-gray-500 group-hover:border-gray-300 group-hover:text-gray-700'
          }`}
        >
          <DirectTransferIcon className="h-[18px] w-[18px]" />
        </span>
        <span>点对点传输</span>
      </button>

      <button
        className={`group flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          transferMode === 'room'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:bg-white/50'
        }`}
        onClick={() => handleModeChange('room')}
        disabled={isTransferring}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
            transferMode === 'room'
              ? 'border-blue-200 bg-blue-50 text-blue-600'
              : 'border-gray-200 bg-white text-gray-500 group-hover:border-gray-300 group-hover:text-gray-700'
          }`}
        >
          <PickupCodeIcon className="h-[18px] w-[18px]" />
        </span>
        <span>取件码模式</span>
      </button>
    </div>
  );
}
