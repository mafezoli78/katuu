export type PendingAction = {
  type: 'ACTIVATE_PRESENCE';
  placeId: string;
  expressionText?: string;
  selfieUrl?: string;
  selfieSource?: 'camera' | 'upload';
};

const KEY = 'katu_pending_action';

export function savePendingAction(action: PendingAction) {
  localStorage.setItem(KEY, JSON.stringify(action));
}

export function getPendingAction(): PendingAction | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function clearPendingAction() {
  localStorage.removeItem(KEY);
}
