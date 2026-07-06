import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import { log } from '@/tools/log';
import Storage from '@/tools/storage';

export type MaxResolution =
  | '2160p'
  | '1440p'
  | '1080p'
  | '720p'
  | '480p'
  | '360p';

export const MAX_RESOLUTION_OPTIONS: MaxResolution[] = [
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
  '360p',
];

export interface Settings {
  maxResolution: MaxResolution;
}

const SETTINGS_KEY = 'ALTUS_SETTINGS';
const DEFAULT_SETTINGS: Settings = { maxResolution: '2160p' };

let g_settings: Settings = { ...DEFAULT_SETTINGS };

const g_eventEmitter = new EventEmitter();
const CHANGE_EVENT = 'change';

function _emit() {
  g_eventEmitter.emit(CHANGE_EVENT);
}

export type Listener = () => void;

export function addListener(listener: Listener) {
  g_eventEmitter.on(CHANGE_EVENT, listener);
  return () => {
    g_eventEmitter.removeListener(CHANGE_EVENT, listener);
  };
}

export function removeListener(listener: Listener) {
  g_eventEmitter.removeListener(CHANGE_EVENT, listener);
}

export async function init(): Promise<void> {
  const result = await Storage.getItem<Settings>(SETTINGS_KEY);
  if (!result.err && result.value) {
    g_settings = { ...DEFAULT_SETTINGS, ...result.value };
  }
  log('settings_store: loaded', g_settings);
  _emit();
}

async function _save(): Promise<void> {
  await Storage.setItem({ key: SETTINGS_KEY, value: g_settings });
}

export function get(): Settings {
  return g_settings;
}

export function useSettings(): Settings {
  return useSyncExternalStore(addListener, get);
}

export function useMaxResolution(): MaxResolution {
  return useSyncExternalStore(addListener, () => g_settings.maxResolution);
}

export async function setMaxResolution(value: MaxResolution): Promise<void> {
  if (g_settings.maxResolution === value) {
    return;
  }
  g_settings = { ...g_settings, maxResolution: value };
  _emit();
  await _save();
  log('settings_store: maxResolution set to', value);
}

export default {
  init,
  addListener,
  removeListener,
  get,
  useSettings,
  useMaxResolution,
  setMaxResolution,
};
