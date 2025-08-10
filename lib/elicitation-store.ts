import type { ElicitationInfo } from '@/lib/elicitation-manager';

type Listener = (state: ElicitationInfo[]) => void;

const listeners = new Set<Listener>();
const state: ElicitationInfo[] = [];

export function getElicitationState(): ElicitationInfo[] {
  return state.slice();
}

function notify(): void {
  const snapshot = state.slice();
  for (const l of listeners) l(snapshot);
}

export function addOrUpdateElicitation(entry: ElicitationInfo): void {
  const idx = state.findIndex(
    (e) => e.elicitationToken === entry.elicitationToken,
  );
  if (idx >= 0) state[idx] = entry;
  else state.push(entry);
  notify();
}

export function removeElicitation(token: string): void {
  const idx = state.findIndex((e) => e.elicitationToken === token);
  if (idx >= 0) {
    state.splice(idx, 1);
    notify();
  }
}

export function subscribeElicitations(listener: Listener): () => void {
  listeners.add(listener);
  listener(getElicitationState());
  return () => listeners.delete(listener);
}
