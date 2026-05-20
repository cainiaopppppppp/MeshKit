import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

type TransferView = 'p2p' | 'room-send' | 'room-receive';

const PICKUP_HOST_NAVIGATION_MESSAGE = '取件码发送中，房主需要留在当前页面保持房间在线。\n\n请先点击“取消发送”关闭房间，再切换到其他功能。';
const PICKUP_RECEIVER_NAVIGATION_MESSAGE = '你已进入取件码房间，接收方也需要留在当前页面保持连接。\n\n请先点击“取消接收”退出房间，再切换到其他功能。';
const P2P_SEND_NAVIGATION_MESSAGE = '点对点发送进行中，请留在当前页面直到传输完成。\n\n如需离开，请先结束当前传输。';
const P2P_RECEIVE_NAVIGATION_MESSAGE = '点对点接收进行中，请留在当前页面直到传输完成。\n\n如需离开，请先结束当前传输。';
const P2P_WAIT_RECEIVER_COMPLETE_MESSAGE = '点对点文件已发送完成，请继续留在当前页面，等待接收方点击“标记为已完成”。\n\n在对方确认之前，请不要切换到其他功能页。';
const P2P_RECEIVED_WAITING_COMPLETE_MESSAGE = '文件已经接收完成，请先点击“标记为已完成”再离开当前页面。';

function getCurrentTransferView(transferMode: 'p2p' | 'room', mode: 'send' | 'receive'): TransferView {
  if (transferMode === 'p2p') {
    return 'p2p';
  }

  return mode === 'send' ? 'room-send' : 'room-receive';
}

export function usePickupHostNavigationGuard(pathname: string) {
  const navigate = useNavigate();
  const currentRoom = useAppStore((state) => state.currentRoom);
  const transferMode = useAppStore((state) => state.transferMode);
  const mode = useAppStore((state) => state.mode);
  const myDeviceId = useAppStore((state) => state.myDeviceId);
  const p2pSessionState = useAppStore((state) => state.p2pSessionState);

  const currentView = getCurrentTransferView(transferMode, mode);
  const isPickupRoomLocked = !!(currentRoom && transferMode === 'room');
  const isPickupHost = !!(currentRoom && myDeviceId && currentRoom.hostId === myDeviceId);
  const isP2PTransferLocked = transferMode === 'p2p' && p2pSessionState !== 'idle';

  let navigationBlockMessage: string | null = null;

  if (isPickupRoomLocked) {
    navigationBlockMessage = isPickupHost
      ? PICKUP_HOST_NAVIGATION_MESSAGE
      : PICKUP_RECEIVER_NAVIGATION_MESSAGE;
  } else if (isP2PTransferLocked) {
    navigationBlockMessage = p2pSessionState === 'receiving'
      ? P2P_RECEIVE_NAVIGATION_MESSAGE
      : p2pSessionState === 'received_waiting_complete'
        ? P2P_RECEIVED_WAITING_COMPLETE_MESSAGE
        : p2pSessionState === 'waiting_receiver_complete'
          ? P2P_WAIT_RECEIVER_COMPLETE_MESSAGE
          : P2P_SEND_NAVIGATION_MESSAGE;
  }

  const isTransferNavigationLocked = !!navigationBlockMessage;

  useEffect(() => {
    if (!isTransferNavigationLocked || pathname === '/') {
      return;
    }

    window.alert(navigationBlockMessage);
    navigate('/', { replace: true });
  }, [isTransferNavigationLocked, navigate, navigationBlockMessage, pathname]);

  useEffect(() => {
    if (!isTransferNavigationLocked) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isTransferNavigationLocked]);

  const showNavigationAlert = () => {
    if (navigationBlockMessage) {
      window.alert(navigationBlockMessage);
    }
  };

  const guardNavigation = (targetPath: string): boolean => {
    if (!isTransferNavigationLocked) {
      return true;
    }

    if (targetPath === pathname || targetPath === '/') {
      return true;
    }

    showNavigationAlert();
    return false;
  };

  const guardTransferViewChange = (targetView: TransferView): boolean => {
    if (!isTransferNavigationLocked) {
      return true;
    }

    if (targetView === currentView) {
      return true;
    }

    showNavigationAlert();
    return false;
  };

  return {
    isPickupHostLocked: isTransferNavigationLocked,
    isTransferNavigationLocked,
    guardNavigation,
    guardTransferViewChange,
    navigationBlockMessage,
  };
}
