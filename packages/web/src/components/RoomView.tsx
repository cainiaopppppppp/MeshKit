/**
 * RoomView - 房间内部界面
 * 显示房间信息、成员列表和传输进度（支持多文件队列）
 */
import { useState, useEffect } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import { FileQueue } from './FileQueue';
import { FileSelector } from './FileSelector';
import { fileStorage } from '../utils/FileStorage';
import { fileTransferManager } from '@meshkit/core';
import type { RoomMember, FileMetadata } from '@meshkit/core';

export function RoomView() {
  const { currentRoom, leaveRoom, startBroadcast, isHost, getOtherMembers } = useRoom();
  const { isTransferring, transferProgress, isQueueMode, fileQueue, hasDownload, queueDirection } = useAppStore();

  // 成员选择文件的状态
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [hasSelectedFiles, setHasSelectedFiles] = useState(false);

  const host = isHost();

  // 当成员加入房间后，如果有文件列表，显示文件选择器
  useEffect(() => {
    if (!host && currentRoom?.isMultiFile && currentRoom.fileList && !hasSelectedFiles) {
      setShowFileSelector(true);
    }
  }, [host, currentRoom?.isMultiFile, currentRoom?.fileList, hasSelectedFiles]);

  // 确认选择的文件
  const handleConfirmSelection = (selectedIndexes: number[]) => {
    if (selectedIndexes.length === 0) {
      alert('请至少选择一个文件');
      return;
    }

    const fileList = currentRoom?.fileList || [];
    const selectedMetadata: FileMetadata[] = selectedIndexes.map(index => fileList[index]);

    // 创建文件队列
    fileTransferManager.createReceiveQueue(selectedMetadata);
    setShowFileSelector(false);
    setHasSelectedFiles(true);
  };

  const handleCancelSelection = () => {
    setShowFileSelector(false);
  };

  // 计算文件列表总大小
  const getTotalSize = (fileList: FileMetadata[]): number => {
    return fileList.reduce((sum, file) => sum + file.size, 0);
  };

  if (!currentRoom) {
    return null;
  }

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

  const handleDownloadFile = async (filename: string) => {
    try {
      const files = await fileStorage.getAllFiles();
      const file = files.find(f => f.filename === filename);

      if (!file) {
        alert(`文件 ${filename} 未找到`);
        return;
      }

      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('下载失败：' + (error as Error).message);
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

      {/* 文件选择器 - 成员选择要接收的文件 */}
      {!host && showFileSelector && currentRoom.fileList && (
        <div className="file-selector-container" style={{
          marginBottom: '1.5rem'
        }}>
          <FileSelector
            files={currentRoom.fileList}
            totalSize={getTotalSize(currentRoom.fileList)}
            onConfirm={handleConfirmSelection}
            onCancel={handleCancelSelection}
          />
        </div>
      )}

      {/* 文件信息 - 队列模式 */}
      {isQueueMode && fileQueue.length > 0 && queueDirection === 'receive' && (
        <div className="mb-4">
          <FileQueue queue={fileQueue} isSender={false} />
        </div>
      )}

      {/* 文件信息 - 单文件模式 */}
      {!isQueueMode && fileInfo && (
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
      {host && (fileInfo || (isQueueMode && fileQueue.length > 0)) && (
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

      {/* 接收完成显示 - 多文件（非房主） */}
      {!host && hasDownload && isQueueMode && queueDirection === 'receive' && fileQueue.length > 0 && (
        <div className="download-complete" style={{
          background: 'linear-gradient(to right, #10b981, #059669)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
            ✅ 文件接收完成！
          </h3>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            maxHeight: '15rem',
            overflowY: 'auto'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>已接收的文件：</p>
            {fileQueue.filter(item => item.status === 'completed').map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span>✓</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.metadata.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{formatFileSize(item.metadata.size)}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadFile(item.metadata.name)}
                  style={{
                    background: 'white',
                    color: '#059669',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  ⬇️ 下载
                </button>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.875rem', textAlign: 'center', opacity: 0.9 }}>
            💡 点击"下载"按钮可重新下载文件
          </p>
        </div>
      )}

      {/* 接收完成显示 - 单文件（非房主） */}
      {!host && hasDownload && !isQueueMode && fileInfo && (
        <div className="download-complete" style={{
          background: 'linear-gradient(to right, #10b981, #059669)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
            ✅ 文件接收完成！
          </h3>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <div style={{ fontSize: '2rem' }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {fileInfo.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.75 }}>
                    {formatFileSize(fileInfo.size)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownloadFile(fileInfo.name)}
                style={{
                  background: 'white',
                  color: '#059669',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseOut={(e) => e.currentTarget.style.background = 'white'}
              >
                ⬇️ 下载
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', textAlign: 'center', opacity: 0.9 }}>
            💡 点击"下载"按钮可重新下载文件
          </p>
        </div>
      )}

      {/* 提示信息 */}
      {!hasDownload && (
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
      )}
    </div>
  );
}
