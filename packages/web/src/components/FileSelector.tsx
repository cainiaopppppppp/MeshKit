/**
 * FileSelector - 文件选择组件
 * 接收方用于选择要接收的文件
 */
import { useState } from 'react';
import type { FileMetadata } from '@meshkit/core';
import { FileTypeIcon, InfoIcon, TransferInboxIcon } from './FileTransferIcons';

interface FileSelectorProps {
  files: FileMetadata[];
  totalSize: number;
  onConfirm: (selectedIndexes: number[]) => void;
  onCancel?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIndex(file: FileMetadata, fallbackIndex: number) {
  return file.index ?? fallbackIndex;
}

function getFileTypeLabel(type: string) {
  if (!type) {
    return '';
  }

  return type.split('/')[0];
}

export function FileSelector({ files, totalSize, onConfirm, onCancel }: FileSelectorProps) {
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set(files.map((file, index) => getFileIndex(file, index))),
  );

  const toggleFile = (fileIndex: number) => {
    const nextSelection = new Set(selectedIndexes);

    if (nextSelection.has(fileIndex)) {
      nextSelection.delete(fileIndex);
    } else {
      nextSelection.add(fileIndex);
    }

    setSelectedIndexes(nextSelection);
  };

  const toggleAll = () => {
    if (selectedIndexes.size === files.length) {
      setSelectedIndexes(new Set());
      return;
    }

    setSelectedIndexes(new Set(files.map((file, index) => getFileIndex(file, index))));
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIndexes));
  };

  const selectedCount = selectedIndexes.size;
  const selectedSize = files.reduce((sum, file, fallbackIndex) => {
    const fileIndex = getFileIndex(file, fallbackIndex);
    return selectedIndexes.has(fileIndex) ? sum + file.size : sum;
  }, 0);

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#e4ebf7] bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3 border-b border-[#edf1f7] px-6 py-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#2f6fff]">
          <TransferInboxIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[26px] font-semibold leading-none text-[#1a1f36]">接收文件</div>
          <div className="mt-2 text-[14px] text-[#7e89ad]">请选择这次要接收的文件</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-[#edf1f7] bg-[#fbfcff] px-6 py-4">
        <div className="text-[15px] text-[#5f6c8f]">
          已选择 <span className="mx-1 font-semibold text-[#1a1f36]">{selectedCount}</span>/
          <span className="mx-1 font-semibold text-[#1a1f36]">{files.length}</span> 个文件
          <span className="mx-2 text-[#c6cfdf]">·</span>
          已选大小 <span className="ml-1 font-semibold text-[#1a1f36]">{formatFileSize(selectedSize)}</span>
          <span className="mx-2 text-[#c6cfdf]">·</span>
          总大小 <span className="ml-1 font-semibold text-[#1a1f36]">{formatFileSize(totalSize)}</span>
        </div>
        <button
          onClick={toggleAll}
          className="shrink-0 text-[14px] font-semibold text-[#2f6fff] transition hover:text-[#174fc8]"
        >
          {selectedCount === files.length ? '取消全选' : '全选'}
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-6 py-3">
        {files.map((file, fallbackIndex) => {
          const fileIndex = getFileIndex(file, fallbackIndex);
          const checked = selectedIndexes.has(fileIndex);
          const fileTypeLabel = getFileTypeLabel(file.type);

          return (
            <button
              key={fileIndex}
              type="button"
              onClick={() => toggleFile(fileIndex)}
              className="flex w-full items-center gap-4 border-b border-[#edf1f7] px-1 py-4 text-left transition last:border-b-0 hover:bg-[#fbfcff]"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border transition ${
                  checked
                    ? 'border-[#2f6fff] bg-[#2f6fff] text-white shadow-[0_6px_14px_rgba(47,111,255,0.24)]'
                    : 'border-[#cfd8e8] bg-white text-transparent'
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m4.75 10.5 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[#e4e9f2] bg-[#f8fafd] text-[#7a86a9]">
                <FileTypeIcon type={file.type} className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-[#1a1f36]">{file.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#7e89ad]">
                  <span>{formatFileSize(file.size)}</span>
                  {fileTypeLabel && (
                    <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-[12px] text-[#6f7da3]">
                      {fileTypeLabel}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#edf1f7] bg-[#fbfcff] px-6 py-4">
        <div className="flex items-center gap-2 text-[13px] text-[#7e89ad]">
          <InfoIcon className="h-4 w-4 shrink-0 text-[#93a0c1]" />
          <span>文件将依次传输，完成后自动下载。</span>
        </div>
      </div>

      <div className="flex gap-3 px-6 pb-6 pt-5">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-[16px] border border-[#dbe3f0] bg-white px-5 py-4 text-[16px] font-semibold text-[#4f5d87] transition hover:border-[#c9d4e7] hover:bg-[#f8fafd]"
          >
            取消
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="flex-[1.2] rounded-[16px] bg-[linear-gradient(135deg,#3578ff_0%,#2b66e8_100%)] px-5 py-4 text-[16px] font-semibold text-white shadow-[0_16px_32px_rgba(53,120,255,0.22)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_36px_rgba(53,120,255,0.28)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {`确认接收 (${selectedCount} 个文件)`}
        </button>
      </div>
    </div>
  );
}
