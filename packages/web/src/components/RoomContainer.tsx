/**
 * RoomContainer - 取件码模式容器
 * 简化的取件码体验：生成取件码或输入取件码
 */
import { useAppStore } from '../store';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { RoomView } from './RoomView';

export function RoomContainer() {
  const { currentRoom, mode, setMode } = useAppStore();

  // 如果已经连接，显示传输界面
  if (currentRoom) {
    return <RoomView />;
  }

  // 显示取件码选择界面
  return (
    <div className="room-container">
      {/* 取件码模式选择 */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setMode('send')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
            mode === 'send'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          生成取件码
        </button>
        <button
          onClick={() => setMode('receive')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all text-sm ${
            mode === 'receive'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          输入取件码
        </button>
      </div>

      {/* 发送模式：生成取件码 */}
      {mode === 'send' && <CreateRoom />}

      {/* 接收模式：输入取件码 */}
      {mode === 'receive' && <JoinRoom />}
    </div>
  );
}
