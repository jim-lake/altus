import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import { getRecentTitles, getTitles } from '@/lib/xcloud_api';
import { herd } from '@/tools/herd';
import { errorLog, log } from '@/tools/log';

import UserStore from './user_store';

import type { Title } from '@/lib/xcloud_api';

let g_latestList: Title[] | null = null;
let g_list: Title[] | null = null;

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
    g_latestList = null;
    g_list = null;
    _emit();
  }
}
export function useLatestList(): Title[] | null {
  return useSyncExternalStore(_subscribe, () => g_latestList);
}
export function useList(): Title[] | null {
  return useSyncExternalStore(_subscribe, () => g_list);
}
export const fetch = herd(async () => {
  try {
    const [recent, all] = await Promise.all([getRecentTitles(), getTitles()]);
    g_latestList = recent;
    g_list = all;
    log('game_store: Loaded', recent.length, 'recent,', all.length, 'titles');
    _emit();
  } catch (e) {
    errorLog('game_store: Failed to fetch games', e);
  }
});

export default { init, useLatestList, useList, fetch };
