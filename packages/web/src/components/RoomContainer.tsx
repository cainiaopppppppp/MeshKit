/**
 * RoomContainer - 房间模式容器
 * 根据状态显示不同的界面：发送（创建房间）或接收（加入房间）
 */
import { useAppStore } from '../store';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { RoomView } from './RoomView';

export function RoomContainer() {
  const { currentRoom, mode, setMode, isTransferring, transferProgress } = useAppStore();

  // 如果已经在房间内，直接显示房间界面
  if (currentRoom) {
    return <RoomView />;
  }

  // 否则显示发送/接收选择和对应界面
  return (
    <div className="room-container">
      {/* 发送/接收选择 */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setMode('send')}
          disabled={isTransferring}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            mode === 'send'
              ? 'bg-white text-primary-500 shadow-md'
              : 'text-gray-600'
          }`}
        >
          📤 发送（创建房间）
        </button>
        <button
          onClick={() => setMode('receive')}
          disabled={isTransferring}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            mode === 'receive'
              ? 'bg-white text-primary-500 shadow-md'
              : 'text-gray-600'
          }`}
        >
          📥 接收（加入房间）
        </button>
      </div>

      {/* 发送模式：创建房间 */}
      {mode === 'send' && <CreateRoom />}

      {/* 接收模式：加入房间 */}
      {mode === 'receive' && (
        <div>
          {/* 如果没有在传输中且没有完成，显示加入房间界面 */}
          {!isTransferring && (
            <JoinRoom />
          )}

          {/* 接收进度 */}
          {isTransferring && transferProgress && transferProgress.direction === 'receive' && (
            <div className="receiving-progress">
              <div className="text-center mb-4">
                <p className="text-lg font-semibold">📥 正在接收房间文件...</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${transferProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600 mb-4">
                <span>速度: {transferProgress.speedMB} MB/s</span>
                <span>剩余: {transferProgress.remainingTime}</span>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  {transferProgress.progress.toFixed(1)}% - 请保持页面打开
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
