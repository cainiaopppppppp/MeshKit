const PICKUP_SHARE_PASSWORD_PREFIX = 'meshkit_pickup_share_password_';

function getPickupPasswordKey(roomId: string): string {
  return `${PICKUP_SHARE_PASSWORD_PREFIX}${roomId.trim()}`;
}

export function savePickupSharePassword(roomId: string, password?: string | null): void {
  const normalizedRoomId = roomId.trim();
  if (!normalizedRoomId || typeof window === 'undefined') {
    return;
  }

  try {
    const normalizedPassword = password?.trim();
    const key = getPickupPasswordKey(normalizedRoomId);

    if (normalizedPassword) {
      window.sessionStorage.setItem(key, normalizedPassword);
      return;
    }

    window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('[pickupShare] Failed to persist pickup password:', error);
  }
}

export function readPickupSharePassword(roomId: string): string | null {
  const normalizedRoomId = roomId.trim();
  if (!normalizedRoomId || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage.getItem(getPickupPasswordKey(normalizedRoomId));
  } catch (error) {
    console.warn('[pickupShare] Failed to read pickup password:', error);
    return null;
  }
}

export function clearPickupSharePassword(roomId: string): void {
  savePickupSharePassword(roomId, null);
}
