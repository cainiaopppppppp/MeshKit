/**
 * RoomView - 房间内部界面
 * 显示房间信息、成员列表和传输进度
 */
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import type { RoomMember } from '@meshkit/core';

export function RoomView() {
  const { currentRoom, leaveRoom, startBroadcast, isHost, getOtherMembers } = useRoom();
  const { isTransferring, transferProgress } = useAppStore();

  if (!currentRoom) {
    return null;
  }

  const host = isHost();
  const otherMembers = getOtherMembers();
  const fileInfo = currentRoom.fileInfo;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getMemberStatusIcon = (member: RoomMember): string => {
    if (member.status === 'completed') return '✅';
    if (member.status === 'receiving') return '📥';
    if (member.status === 'failed') return '❌';
    return '⏳';
  };

  const getMemberStatusText = (member: RoomMember): string => {
    if (member.status === 'completed') return '已完成';
    if (member.status === 'receiving') return '接收中';
    if (member.status === 'failed') return '失败';
    return '等待中';
  };

  const handleStartBroadcast = async () => {
    if (otherMembers.length === 0) {
      alert('房间内没有其他成员，无法开始传输');
      return;
    }

    const confirm = window.confirm(
      `确定要开始向 ${otherMembers.length} 个成员广播文件吗？`
    );

    if (confirm) {
      await startBroadcast();
    }
  };

  const handleLeaveRoom = () => {
    const confirmLeave = window.confirm(
      host
        ? '您是房主，离开后房间将关闭，确定要离开吗？'
        : '确定要离开房间吗？'
    );

    if (confirmLeave) {
      leaveRoom();
    }
  };

  return (
    <div className="room-view">
      {/* 房间头部 */}
      <div className="room-header">
        <div className="room-info">
          <h2 className="room-title">
            🏠 {currentRoom.name}
          </h2>
          <div className="room-id-display">
            <span className="room-id-label">房间号：</span>
            <span className="room-id-value">{currentRoom.id}</span>
          </div>
          <div className="room-role">
            {host ? '👑 房主' : '👤 成员'}
          </div>
        </div>

        <button className="leave-room-button" onClick={handleLeaveRoom}>
          离开房间
        </button>
      </div>

      {/* 文件信息 */}
      {fileInfo && (
        <div className="file-info-card">
          <div className="file-icon-large">📄</div>
          <div className="file-details">
            <div className="file-name-large">{fileInfo.name}</div>
            <div className="file-size-large">{formatFileSize(fileInfo.size)}</div>
            <div className="file-type">{fileInfo.type || '未知类型'}</div>
          </div>
        </div>
      )}

      {/* 传输控制（仅房主） */}
      {host && fileInfo && (
        <div className="broadcast-control">
          {!isTransferring ? (
            <button
              className="start-broadcast-button"
              onClick={handleStartBroadcast}
              disabled={otherMembers.length === 0}
            >
              {otherMembers.length === 0
                ? '等待成员加入...'
                : `开始向 ${otherMembers.length} 个成员广播`}
            </button>
          ) : (
            <div className="broadcast-status">
              <div className="status-icon">📡</div>
              <div className="status-text">正在广播文件...</div>
              {transferProgress && (
                <div className="overall-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${transferProgress.progress}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {transferProgress.progress.toFixed(1)}% - {transferProgress.speedMB} MB/s
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 成员列表 */}
      <div className="members-section">
        <h3 className="members-title">
          📋 房间成员 ({currentRoom.members.length})
        </h3>

        <div className="members-list">
          {currentRoom.members.map((member) => (
            <div
              key={member.deviceId}
              className={`member-item ${member.role === 'host' ? 'host' : ''}`}
            >
              <div className="member-avatar">
                {member.role === 'host' ? '👑' : '👤'}
              </div>

              <div className="member-info">
                <div className="member-name">
                  {member.deviceName}
                  {member.role === 'host' && (
                    <span className="host-badge">房主</span>
                  )}
                </div>
                <div className="member-status">
                  {getMemberStatusIcon(member)} {getMemberStatusText(member)}
                </div>
              </div>

              {/* 进度条（仅在传输中显示） */}
              {member.role !== 'host' && member.progress !== undefined && member.progress > 0 && (
                <div className="member-progress">
                  <div className="progress-bar-small">
                    <div
                      className="progress-fill-small"
                      style={{ width: `${member.progress}%` }}
                    />
                  </div>
                  <div className="progress-percentage">
                    {member.progress.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 提示信息 */}
      <div className="room-tips">
        {host ? (
          <>
            <p>💡 等待成员加入后，点击"开始广播"向所有成员发送文件</p>
            <p>⚠️ 传输过程中请保持连接，直到所有成员接收完成</p>
          </>
        ) : (
          <>
            <p>💡 等待房主开始传输文件</p>
            <p>📥 接收完成后文件会自动下载</p>
          </>
        )}
      </div>
    </div>
  );
}
