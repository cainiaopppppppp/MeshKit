/**
 * JoinRoom - 输入取件码界面
 */
import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { CheckCircleIcon, LockIcon, WarningIcon } from './FileTransferIcons';
import { parseShareInvitePayloadFromUrl } from '../utils/signalingConfig';
import { savePickupSharePassword } from '../utils/pickupShare';

export function JoinRoom() {
  const { joinRoom, isJoining, error } = useRoom();
  const [code, setCode] = useState('');
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const sharedPickup = parseShareInvitePayloadFromUrl(window.location.href)?.pickup;
    if (!sharedPickup?.code) {
      return;
    }

    setCode(sharedPickup.code.replace(/\D/g, '').slice(0, 6));

    if (sharedPickup.passwordProtected || sharedPickup.password) {
      setEnablePassword(true);
    }

    if (sharedPickup.password) {
      setPassword(sharedPickup.password);
      savePickupSharePassword(sharedPickup.code, sharedPickup.password);
    }
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      alert('请输入 6 位取件码');
      return;
    }

    await joinRoom(code, enablePassword ? password : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleJoin();
    }
  };

  const renderCodeBox = (index: number) => {
    const digit = code[index] ?? '';
    const isActive = isCodeFocused && code.length === index;
    const isFilled = digit.length > 0;

    return (
      <button
        key={index}
        type="button"
        onClick={() => codeInputRef.current?.focus()}
        className={`flex h-[58px] w-[52px] items-center justify-center rounded-[16px] border bg-white text-[28px] font-semibold text-[#1a1f36] shadow-[0_1px_3px_rgba(26,31,54,0.04)] transition sm:h-[62px] sm:w-[56px] ${
          isActive
            ? 'border-[#1a6dff] shadow-[0_0_0_4px_rgba(26,109,255,0.1)]'
            : isFilled
              ? 'border-[#c7d7f6]'
              : 'border-[#dfe5ef]'
        }`}
      >
        {digit}
      </button>
    );
  };

  return (
    <div className="join-room">
      <div className="mb-8 text-center">
        <h3 className="mb-2 text-[28px] font-bold tracking-[-0.03em] text-[#1a1f36]">输入取件码</h3>
        <p className="text-[14px] text-[#8e95b2]">请输入对方分享的 6 位取件码</p>
      </div>

      <div className="mb-8">
        <div className="relative">
          <input
            ref={codeInputRef}
            id="code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsCodeFocused(true)}
            onBlur={() => setIsCodeFocused(false)}
            className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0"
            aria-label="取件码输入框"
          />

          <button
            type="button"
            onClick={() => codeInputRef.current?.focus()}
            className="flex w-full items-center justify-center gap-3 sm:gap-4"
          >
            {[0, 1, 2].map(renderCodeBox)}
            <span className="text-lg font-medium text-[#9aa4bf]">-</span>
            {[3, 4, 5].map(renderCodeBox)}
          </button>
        </div>

        <div className="mt-4 text-center">
          {code.length > 0 && code.length < 6 && (
            <span className="text-sm text-[#8e95b2]">还需输入 {6 - code.length} 位数字</span>
          )}
          {code.length === 6 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              <span>取件码已输入完整</span>
            </span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="enable-password"
            checked={enablePassword}
            onChange={(e) => setEnablePassword(e.target.checked)}
            className="h-4 w-4 rounded text-green-600 focus:ring-2 focus:ring-green-500"
          />
          <label htmlFor="enable-password" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-600">
              <LockIcon className="h-3.5 w-3.5" />
            </span>
            <span>房间有密码保护</span>
          </label>
        </div>

        {enablePassword && (
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入房间密码"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            />
            <p className="mt-2 text-xs text-gray-500">如果房间设置了密码，请输入正确密码</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          <div className="flex items-center gap-2">
            <WarningIcon className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <button
        className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-[0_16px_40px_rgba(16,185,129,0.24)] transition-all hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleJoin}
        disabled={code.length !== 6 || isJoining}
      >
        {isJoining ? '连接中...' : '开始接收文件'}
      </button>

      <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-center text-sm text-gray-600">连接成功后，可以选择要接收的文件</p>
        <p className="mt-1 text-center text-sm text-gray-600">确保与发送方处于同一局域网环境</p>
      </div>
    </div>
  );
}
