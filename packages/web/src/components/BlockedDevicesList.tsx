/**
 * 屏蔽设备列表组件
 * 显示当前被屏蔽的设备，并提供解除屏蔽功能
 */

import { useState, useEffect } from 'react';
import type { BlockedDevice } from '@meshkit/core';

interface BlockedDevicesListProps {
  blockedDevices: BlockedDevice[];
  onUnblock: (deviceId: string) => void;
}

export function BlockedDevicesList({ blockedDevices, onUnblock }: BlockedDevicesListProps) {
  const [expanded, setExpanded] = useState(true);
  const [remainingTimes, setRemainingTimes] = useState<Record<string, number>>({});

  // 每秒更新剩余时间
  useEffect(() => {
    const updateRemainingTimes = () => {
      const now = Date.now();
      const times: Record<string, number> = {};

      blockedDevices.forEach((device) => {
        const remaining = Math.max(0, device.blockedUntil - now);
        times[device.deviceId] = Math.ceil(remaining / 1000);
      });

      setRemainingTimes(times);
    };

    updateRemainingTimes();
    const interval = setInterval(updateRemainingTimes, 1000);

    return () => clearInterval(interval);
  }, [blockedDevices]);

  const formatRemainingTime = (seconds: number): string => {
    if (seconds <= 0) return '即将解除';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}时${minutes}分${secs}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  if (blockedDevices.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg overflow-hidden">
      {/* 标题栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-100 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🚫</span>
          <span className="font-medium text-red-900">
            已屏蔽的设备 ({blockedDevices.length})
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-red-700 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 设备列表 */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {blockedDevices.map((device) => (
            <div
              key={device.deviceId}
              className="bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  📱 {device.deviceName}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  剩余: {formatRemainingTime(remainingTimes[device.deviceId] || 0)}
                </div>
              </div>
              <button
                onClick={() => onUnblock(device.deviceId)}
                className="ml-3 px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-all whitespace-nowrap"
              >
                解除屏蔽
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
