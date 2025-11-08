/**
 * CreateRoom - 创建房间界面
 */
import { useState, useRef } from 'react';
import { useRoom } from '../hooks/useRoom';

export function CreateRoom() {
  const { createRoom, isCreating, error } = useRoom();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedFile) {
      alert('请先选择文件');
      return;
    }

    await createRoom(selectedFile);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="create-room">
      <h3 className="section-title">📤 创建传输房间</h3>

      <div className="file-select-area">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="file-input"
          id="room-file-input"
        />
        <label htmlFor="room-file-input" className="file-select-button">
          {selectedFile ? '更换文件' : '选择文件'}
        </label>

        {selectedFile && (
          <div className="selected-file-info">
            <div className="file-icon">📄</div>
            <div className="file-details">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <button
        className="create-room-button"
        onClick={handleCreateRoom}
        disabled={!selectedFile || isCreating}
      >
        {isCreating ? '创建中...' : '创建房间'}
      </button>

      <div className="info-text">
        <p>💡 创建房间后，其他用户可以通过房间号加入并接收文件</p>
        <p>⚠️ 作为房主，您需要保持在线直到所有成员接收完成</p>
      </div>
    </div>
  );
}
