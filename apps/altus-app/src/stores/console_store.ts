import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import type { Console } from '@/lib/xcloud_api';

import { getConsoles } from '@/lib/xcloud_api';
import { errorLog, log } from '@/tools/log';

let g_consoles: Console[] | null = null;

const g_eventEmitter = new EventEmitter();
const CHANGE_EVENT = 'change';
function _emit() {
  g_eventEmitter.emit(CHANGE_EVENT);
}
function _subscribe(callback: () => void) {
  g_eventEmitter.on(CHANGE_EVENT, callback);
  return () => {
    g_eventEmitter.removeListener(CHANGE_EVENT, callback);
  };
}

export function useList(): Console[] | null {
  return useSyncExternalStore(_subscribe, () => g_consoles);
}

export async function fetch(): Promise<void> {
  try {
    const result = await getConsoles();
    g_consoles = result;
    log('console_store: Loaded', result.length, 'consoles');
    _emit();
  } catch (e) {
    errorLog('console_store: Failed to fetch consoles', e);
  }
}

export function clear(): void {
  g_consoles = null;
  _emit();
}

export default { useList, fetch, clear };
