/**
 * CreateRoom - 生成取件码界面
 */
import { useRef, useState } from 'react';
import { fileTransferManager, type FileQueueItem } from '@meshkit/core';
import { useRoom } from '../hooks/useRoom';
import { useAppStore } from '../store';
import { ExperienceCard } from './ExperienceShell';
import { FileQueue } from './FileQueue';
import { TransferInboxIcon } from './FileTransferIcons';
import { RoomPasswordDialog } from './RoomPasswordDialog';
import { savePickupSharePassword } from '../utils/pickupShare';

export function CreateRoom() {
  const { createRoom, isCreating, error, updateRoomFiles, currentRoom } = useRoom();
  const { fileQueue, isQueueMode } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  const syncRoomFiles = () => {
    if (!currentRoom) return;

    const currentQueue = fileTransferManager.getFileQueue();
    const updatedFileList = currentQueue.map((item) => ({
      ...item.metadata,
      index: item.index,
    }));

    updateRoomFiles(updatedFileList);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileTransferManager.fullReset();
    setSelectedFile(null);

    if (files.length === 1) {
      setSelectedFile(files[0]);
    } else {
      await fileTransferManager.selectFiles(Array.from(files), true);
      syncRoomFiles();
    }

    e.target.value = '';
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    if (isQueueMode || fileQueue.length > 0) {
      await fileTransferManager.appendFiles(filesArray);
      syncRoomFiles();
    } else if (selectedFile) {
      await fileTransferManager.selectFiles([selectedFile, ...filesArray], true);
      setSelectedFile(null);
      syncRoomFiles();
    } else if (filesArray.length === 1) {
      setSelectedFile(filesArray[0]);
    } else {
      await fileTransferManager.selectFiles(filesArray, true);
      syncRoomFiles();
    }

    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    fileTransferManager.fullReset();
    setSelectedFile(null);

    const filesArray = Array.from(files);
    if (filesArray.length === 1) {
      setSelectedFile(filesArray[0]);
      return;
    }

    await fileTransferManager.selectFiles(filesArray, true);
    syncRoomFiles();
  };

  const handleRemoveFile = (index: number) => {
    if (!isQueueMode && selectedFile) {
      fileTransferManager.fullReset();
      setSelectedFile(null);
      return;
    }

    fileTransferManager.removeFileFromQueue(index);
    syncRoomFiles();
  };

  const handleClearAll = () => {
    fileTransferManager.clearFileQueue();
    setSelectedFile(null);
    syncRoomFiles();
  };

  const handleCreateRoomClick = () => {
    if (displayQueue.length === 0) {
      alert('请先选择文件');
      return;
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordConfirm = async (password: string | null) => {
    setShowPasswordDialog(false);

    if (isQueueMode) {
      const firstFile = fileQueue.find((item) => item.selected)?.file;
      if (firstFile) {
        const room = await createRoom(firstFile, password || undefined);
        if (room) {
          savePickupSharePassword(room.id, password);
        }
      }
      return;
    }

    if (selectedFile) {
      const room = await createRoom(selectedFile, password || undefined);
      if (room) {
        savePickupSharePassword(room.id, password);
      }
    }
  };

  const displayQueue: FileQueueItem[] =
    isQueueMode && fileQueue.length > 0
      ? fileQueue
      : selectedFile
        ? [
            {
              file: selectedFile,
              index: 0,
              metadata: {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
              },
              status: 'pending',
              progress: 0,
              selected: true,
            },
          ]
        : [];

  return (
    <div className="create-room space-y-4">
      {displayQueue.length === 0 && (
        <ExperienceCard className="p-0">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-[14px] border-2 border-dashed px-6 py-14 text-center transition-all ${
              dragOver
                ? 'border-[#1a6dff] bg-[#e8f0ff]'
                : 'border-[#e8ecf2] bg-[#f8fafd] hover:border-[#c9d9ff] hover:bg-[#f4f8ff]'
            }`}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#e8f0ff] text-[#1a6dff]">
              <TransferInboxIcon className="h-6 w-6" />
            </div>
            <div className="text-[15px] font-semibold text-[#1a1f36]">选择文件</div>
            <div className="mt-2 text-[12px] text-[#8e95b2]">点击或拖拽文件到此处</div>
          </div>
        </ExperienceCard>
      )}

      {displayQueue.length > 0 && (
        <ExperienceCard className="p-5">
          <FileQueue queue={displayQueue} isSender={true} onRemove={handleRemoveFile} />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex-1 rounded-full border border-[#bfd6ff] bg-white px-4 py-3 text-[13px] font-semibold text-[#4f5d87] transition hover:border-[#1a6dff] hover:text-[#1a6dff]"
            >
              更换文件
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addFilesInputRef.current?.click();
              }}
              className="flex-1 rounded-full bg-[#1a6dff] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#0a4fc9]"
            >
              添加文件
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 rounded-full bg-[#e11d48] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#be123c]"
            >
              清空
            </button>
          </div>
        </ExperienceCard>
      )}

      <input
        ref={fileInputRef}
        id="room-file-input"
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={addFilesInputRef}
        id="room-add-files-input"
        type="file"
        multiple
        onChange={handleAddFiles}
        className="hidden"
      />

      {error && (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        className="w-full rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleCreateRoomClick}
        disabled={displayQueue.length === 0 || isCreating}
      >
        {isCreating ? '生成中...' : '生成取件码'}
      </button>

      {showPasswordDialog && (
        <RoomPasswordDialog
          onConfirm={handlePasswordConfirm}
          onCancel={() => setShowPasswordDialog(false)}
        />
      )}
    </div>
  );
}
