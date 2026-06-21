import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import { getConsoles } from '@/lib/xcloud_api';
import { herd } from '@/tools/herd';
import { errorLog, log } from '@/tools/log';

import UserStore from './user_store';

import type { Console } from '@/lib/xcloud_api';

let g_consoleList: Console[] | null = null;

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

export function init() {
  UserStore.addListener(_onUserChange);
}
function _onUserChange() {
  if (!UserStore.isLoggedIn()) {
    g_consoleList = null;
    _emit();
  }
}
export function useList(): Console[] | null {
  return useSyncExternalStore(_subscribe, () => g_consoleList);
}
export const fetch = herd(async () => {
  try {
    const result = await getConsoles();
    g_consoleList = result;
    log('console_store: Loaded', result.length, 'consoles');
    _emit();
  } catch (e) {
    errorLog('console_store: Failed to fetch consoles', e);
  }
});

export default { init, useList, fetch };
