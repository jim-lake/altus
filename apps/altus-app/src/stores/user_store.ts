import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import {
  checkDeviceCode,
  getStreamingTokens,
  refreshAccessToken,
  startDeviceCodeAuth,
} from '@/lib/auth';
import api from '@/tools/api';
import { errorLog, log } from '@/tools/log';
import Storage from '@/tools/storage';

import type { DeviceCodeResponse } from '@/lib/auth';
import type { RequestParams, RequestResponse } from '@/tools/api';

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
let g_baseUri = '';
let g_streamToken = '';
let g_streamExpiresAt = 0;
let g_pollAbort: (() => void) | null = null;

const g_eventEmitter = new EventEmitter();
const CHANGE_EVENT = 'change';
function _emit(reason: string) {
  g_eventEmitter.emit(CHANGE_EVENT, reason);
}
export type Listener = (reason?: string) => void;
export function addListener(listener: Listener) {
  g_eventEmitter.on(CHANGE_EVENT, listener);
  return () => {
    g_eventEmitter.removeListener(CHANGE_EVENT, listener);
  };
}
export function removeListener(listener: Listener) {
  g_eventEmitter.removeListener(CHANGE_EVENT, listener);
}
export async function init() {
  await _load();
  if (g_refreshToken) {
    await _verifyToken();
  }
  g_isReady = true;
  _emit('ready');
}
export function useIsReady() {
  return useSyncExternalStore(addListener, () => g_isReady);
}
export function isLoggedIn() {
  return Boolean(g_streamToken);
}
export function useIsLoggedIn() {
  return useSyncExternalStore(addListener, isLoggedIn);
}
export function getAccessToken(): string {
  return g_accessToken;
}
export function getRefreshToken(): string {
  return g_refreshToken;
}

export interface StartLoginResult {
  deviceCode: DeviceCodeResponse;
}
export async function startLogin(): Promise<StartLoginResult> {
  _stopPolling();

  const deviceCode = await startDeviceCodeAuth();
  const intervalMs = deviceCode.interval * 1000;

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) {
      return;
    }
    try {
      const tokenResp = await checkDeviceCode(deviceCode.device_code);
      if (stopped) {
        return;
      }
      if (tokenResp) {
        _stopPolling();
        g_accessToken = tokenResp.access_token;
        g_refreshToken = tokenResp.refresh_token;
        g_expiresAt = Date.now() + tokenResp.expires_in * 1000;
        const tokens = await getStreamingTokens(g_accessToken);
        if (tokens.xHomeToken) {
          const region =
            tokens.xHomeToken.offeringSettings.regions.find(
              (r) => r.isDefault
            ) ?? tokens.xHomeToken.offeringSettings.regions[0];
          if (region) {
            g_baseUri = region.baseUri;
          }
          g_streamToken = tokens.xHomeToken.gsToken;
          g_streamExpiresAt =
            Date.now() + tokens.xHomeToken.durationInSeconds * 1000;
        }
        await _save();
        log('user_store: Login complete');
        _emit('login');
      }
    } catch (e) {
      if (!stopped) {
        errorLog('user_store: Poll tick failed', e);
      }
    }
  };

  timer = setInterval(() => void tick(), intervalMs);

  g_pollAbort = () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { deviceCode };
}

function _stopPolling() {
  if (g_pollAbort) {
    g_pollAbort();
    g_pollAbort = null;
  }
}

export async function logout(): Promise<void> {
  _stopPolling();
  g_accessToken = '';
  g_refreshToken = '';
  g_expiresAt = 0;
  g_baseUri = '';
  g_streamToken = '';
  g_streamExpiresAt = 0;
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
      expires_at: g_expiresAt,
    },
  });
}
async function _verifyToken() {
  if (!g_refreshToken) {
    g_accessToken = '';
    return;
  }
  try {
    if (g_expiresAt <= Date.now()) {
      const tokenResp = await refreshAccessToken(g_refreshToken);
      g_accessToken = tokenResp.access_token;
      g_refreshToken = tokenResp.refresh_token;
      g_expiresAt = Date.now() + tokenResp.expires_in * 1000;
    }
    const tokens = await getStreamingTokens(g_accessToken);
    if (tokens.xHomeToken) {
      const region =
        tokens.xHomeToken.offeringSettings.regions.find((r) => r.isDefault) ??
        tokens.xHomeToken.offeringSettings.regions[0];
      if (region) {
        g_baseUri = region.baseUri;
      }
      g_streamToken = tokens.xHomeToken.gsToken;
      g_streamExpiresAt =
        Date.now() + tokens.xHomeToken.durationInSeconds * 1000;
    }
    await _save();
  } catch {
    errorLog('user_store: Token verify failed, clearing session');
    g_accessToken = '';
    g_refreshToken = '';
    g_expiresAt = 0;
    g_baseUri = '';
    g_streamToken = '';
    g_streamExpiresAt = 0;
    await _save();
  }
}

const DEVICE_INFO = JSON.stringify({
  appInfo: {
    env: {
      clientAppId: 'Microsoft.GamingApp',
      clientAppType: 'native',
      clientAppVersion: '2203.1001.5.0',
    },
  },
  dev: {
    hw: { make: 'Microsoft', model: 'Surface Pro', sdktype: 'native' },
    os: { name: 'windows', ver: '22631.2715', platform: 'desktop' },
    displayInfo: {
      dimensions: { widthInPixels: 1920, heightInPixels: 1080 },
      pixelDensity: { dpiX: 1, dpiY: 1 },
    },
  },
});

function _resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return g_baseUri + url;
}

async function _ensureStreamToken(): Promise<void> {
  if (g_streamToken && g_streamExpiresAt > Date.now() + 60_000) {
    return;
  }
  if (!g_accessToken) {
    throw new Error('not_logged_in');
  }
  if (g_expiresAt <= Date.now()) {
    const tokenResp = await refreshAccessToken(g_refreshToken);
    g_accessToken = tokenResp.access_token;
    g_refreshToken = tokenResp.refresh_token;
    g_expiresAt = Date.now() + tokenResp.expires_in * 1000;
    await _save();
  }
  const tokens = await getStreamingTokens(g_accessToken);
  if (tokens.xHomeToken) {
    const region =
      tokens.xHomeToken.offeringSettings.regions.find((r) => r.isDefault) ??
      tokens.xHomeToken.offeringSettings.regions[0];
    if (region) {
      g_baseUri = region.baseUri;
    }
    g_streamToken = tokens.xHomeToken.gsToken;
    g_streamExpiresAt = Date.now() + tokens.xHomeToken.durationInSeconds * 1000;
  }
}

async function _prepareParams(params: RequestParams): Promise<RequestParams> {
  await _ensureStreamToken();
  params.url = _resolveUrl(params.url);
  const authHeaders: Record<string, string> = {
    authorization: `Bearer ${g_streamToken}`,
    'x-gssv-client': 'XboxComBrowser',
    'x-ms-device-info': DEVICE_INFO,
  };
  if (params.headers) {
    params.headers = { ...authHeaders, ...params.headers };
  } else {
    params.headers = authHeaders;
  }
  return params;
}

export async function get<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  return api.get<T>(await _prepareParams(params));
}
export async function put<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  return api.put<T>(await _prepareParams(params));
}
export async function post<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  return api.post<T>(await _prepareParams(params));
}
export async function del<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  return api.del<T>(await _prepareParams(params));
}

export default {
  addListener,
  removeListener,
  init,
  isLoggedIn,
  useIsReady,
  useIsLoggedIn,
  startLogin,
  logout,
  getAccessToken,
  getRefreshToken,
  get,
  put,
  post,
  del,
};
