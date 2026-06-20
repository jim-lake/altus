import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import type { RequestParams, RequestResponse } from '@/tools/api';

import api from '@/tools/api';
import { errorLog } from '@/tools/log';
import Storage from '@/tools/storage';

export interface SavedToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const TOKEN_KEY = 'ALTUS_TOKEN_KEY';

let g_isReady = false;
let g_accessToken = '';
let g_refreshToken = '';
let g_expiresAt = 0;

const g_eventEmitter = new EventEmitter();
const CHANGE_EVENT = 'change';
function _emit(reason: string) {
  g_eventEmitter.emit(CHANGE_EVENT, reason);
}
function _subscribe(callback: (reason: string) => void) {
  g_eventEmitter.on(CHANGE_EVENT, callback);
  return () => {
    g_eventEmitter.removeListener(CHANGE_EVENT, callback);
  };
}
export async function init() {
  await _load();
  if (g_accessToken) {
    await _verifyToken();
  }
  g_isReady = true;
  _emit('ready');
}
export function useIsReady() {
  return useSyncExternalStore(_subscribe, () => g_isReady);
}
export function useIsLoggedIn() {
  return useSyncExternalStore(_subscribe, () => Boolean(g_accessToken));
}

export interface StartLoginResult {}
export async function startLogin(): Promise<StartLoginResult> {
  // stop an existing pooling loop if happening,
  // calls startDeviceCodeAuth to get the stuff the UI needs
  // starts a polling loop that will save the token into g_accessToken and then _emit to cause useIsLoggedIn to flip true
  // returns stuff needed by the UI

  return {};
}

export async function logout(): Promise<void> {
  g_accessToken = '';
  g_refreshToken = '';
  g_expiresAt = 0;
  await _save();
  _emit('logout');
}
async function _load() {
  const result = await Storage.getItem<SavedToken>(TOKEN_KEY);
  if (!result.err && result.value?.access_token) {
    g_accessToken = result.value.access_token;
    g_refreshToken = result.value.refresh_token;
    g_expiresAt = result.value.expires_at;
  }
}
async function _save() {
  await Storage.setItem({
    key: TOKEN_KEY,
    value: {
      access_token: g_accessToken,
      refresh_token: g_refreshToken,
      g_expiresAt: g_expiresAt,
    },
  });
}
async function _verifyToken() {
  if (g_expiresAt > Date.now()) {
    // do some trivial http request that verifies the token is valid
  } else {
    // refresh token, if refresh fails just clear g_accessToken, g_refreshToken, g_expiresAt
  }
}

function _addBearer(params: RequestParams) {
  if (!g_accessToken) {
    throw new Error('not_logged_in');
  }
  if (params.headers) {
    params.headers.authorization = `Bearer ${g_accessToken}`;
  } else {
    params.headers = { authorization: `Bearer ${g_accessToken}` };
  }
}
export async function get<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  _addBearer(params);
  return api.get<T>(params);
}
export async function put<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  _addBearer(params);
  return api.put<T>(params);
}
export async function post<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  _addBearer(params);
  return api.post<T>(params);
}
export async function del<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  _addBearer(params);
  return api.del<T>(params);
}
export async function request<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  _addBearer(params);
  return api.request<T>(params);
}

export default { init, useIsReady, startLogin, get, put, post, del, request };
