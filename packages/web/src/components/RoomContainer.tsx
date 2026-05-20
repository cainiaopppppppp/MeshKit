/**
 * RoomContainer - 取件码模式容器
 */
import { useAppStore } from '../store';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { RoomView } from './RoomView';

interface RoomContainerProps {
  showModeTabs?: boolean;
}

export function RoomContainer({ showModeTabs = true }: RoomContainerProps) {
  const { currentRoom, mode, setMode } = useAppStore();

  if (currentRoom) {
    return <RoomView />;
  }

  return (
    <div className="room-container space-y-5">
      {showModeTabs ? (
        <div className="flex gap-2 rounded-[22px] border border-slate-200 bg-slate-100/80 p-1.5">
          <button
            onClick={() => setMode('send')}
            className={`flex-1 rounded-[18px] py-3 font-medium transition-all text-sm ${
              mode === 'send'
                ? 'bg-white text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.16)]'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            生成取件码
          </button>
          <button
            onClick={() => setMode('receive')}
            className={`flex-1 rounded-[18px] py-3 font-medium transition-all text-sm ${
              mode === 'receive'
                ? 'bg-white text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.16)]'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            输入取件码
          </button>
        </div>
      ) : null}

      {mode === 'send' ? <CreateRoom /> : <JoinRoom />}
    </div>
  );
}
