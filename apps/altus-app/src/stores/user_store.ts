import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import {
  checkDeviceCode,
  getMsalToken,
  getStreamingTokens,
  refreshAccessToken,
  startDeviceCodeAuth,
} from '@/lib/auth';
import api from '@/tools/api';
import { errorLog, log } from '@/tools/log';
import Storage from '@/tools/storage';

import type { DeviceCodeResponse, StreamingTokenResponse } from '@/lib/auth';
import type { RequestParams, RequestResponse } from '@/tools/api';

export interface SavedToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface StreamingToken {
  token: string;
  expiresAt: number;
  baseUri: string;
  type: 'xHome' | 'xgpuweb' | 'xgpuwebf2p';
}

export type CredentialType = 'xHome' | 'xgpuweb' | 'msal';

const TOKEN_KEY = 'ALTUS_TOKEN_KEY';

let g_isReady = false;
let g_accessToken = '';
let g_refreshToken = '';
let g_expiresAt = 0;
let g_xHome: StreamingToken | null = null;
let g_xGpuWeb: StreamingToken | null = null;
let g_msalToken: StreamingToken | null = null;
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
  return Boolean(g_xHome);
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

function _applyStreamingTokens(tokens: {
  xHomeToken: StreamingTokenResponse | null;
  xCloudToken: StreamingTokenResponse | null;
}) {
  if (tokens.xHomeToken) {
    const region =
      tokens.xHomeToken.offeringSettings.regions.find((r) => r.isDefault) ??
      tokens.xHomeToken.offeringSettings.regions[0];
    g_xHome = {
      token: tokens.xHomeToken.gsToken,
      expiresAt: Date.now() + tokens.xHomeToken.durationInSeconds * 1000,
      baseUri: region?.baseUri ?? '',
      type: 'xHome',
    };
  }
  if (tokens.xCloudToken) {
    const region =
      tokens.xCloudToken.offeringSettings.regions.find((r) => r.isDefault) ??
      tokens.xCloudToken.offeringSettings.regions[0];
    g_xGpuWeb = {
      token: tokens.xCloudToken.gsToken,
      expiresAt: Date.now() + tokens.xCloudToken.durationInSeconds * 1000,
      baseUri: region?.baseUri ?? '',
      type: tokens.xCloudToken.market ? 'xgpuweb' : 'xgpuwebf2p',
    };
  }
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

  async function tick() {
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
        _applyStreamingTokens(tokens);
        await _save();
        log('user_store: Login complete');
        _emit('login');
      }
    } catch (e) {
      if (!stopped) {
        errorLog('user_store: Poll tick failed', e);
      }
    }
  }

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
  g_xHome = null;
  g_xGpuWeb = null;
  g_msalToken = null;
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
    _applyStreamingTokens(tokens);
    await _save();
  } catch {
    errorLog('user_store: Token verify failed, clearing session');
    g_accessToken = '';
    g_refreshToken = '';
    g_expiresAt = 0;
    g_xHome = null;
    g_xGpuWeb = null;
    g_msalToken = null;
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

function _getCredential(credentialType: CredentialType): StreamingToken | null {
  if (credentialType === 'xHome') {
    return g_xHome;
  }
  if (credentialType === 'msal') {
    return g_msalToken;
  }
  return g_xGpuWeb;
}

function _resolveUrl(url: string, credential: StreamingToken): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return credential.baseUri + url;
}

async function _ensureStreamToken(
  credentialType: CredentialType
): Promise<StreamingToken> {
  const existing = _getCredential(credentialType);
  if (existing && existing.expiresAt > Date.now() + 60_000) {
    return existing;
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
  if (credentialType === 'msal') {
    const token = await getMsalToken(g_refreshToken);
    g_msalToken = {
      token,
      expiresAt: Date.now() + 3600 * 1000,
      baseUri: '',
      type: 'xHome',
    };
    return g_msalToken;
  }
  const tokens = await getStreamingTokens(g_accessToken);
  _applyStreamingTokens(tokens);
  const credential = _getCredential(credentialType);
  if (!credential) {
    throw new Error(`no_credential_${credentialType}`);
  }
  return credential;
}

export interface AuthenticatedRequestParams extends RequestParams {
  credentialType: CredentialType;
}

async function _prepareParams(
  params: AuthenticatedRequestParams
): Promise<RequestParams> {
  const credential = await _ensureStreamToken(params.credentialType);
  const prepared: RequestParams = { ...params };
  prepared.url = _resolveUrl(params.url, credential);
  const authHeaders: Record<string, string> = {
    authorization: `Bearer ${credential.token}`,
    'x-gssv-client': 'XboxComBrowser',
    'x-ms-device-info': DEVICE_INFO,
  };
  if (prepared.headers) {
    prepared.headers = { ...authHeaders, ...prepared.headers };
  } else {
    prepared.headers = authHeaders;
  }
  return prepared;
}

export async function get<T>(
  params: AuthenticatedRequestParams
): Promise<RequestResponse<T>> {
  return api.get<T>(await _prepareParams(params));
}
export async function put<T>(
  params: AuthenticatedRequestParams
): Promise<RequestResponse<T>> {
  return api.put<T>(await _prepareParams(params));
}
export async function post<T>(
  params: AuthenticatedRequestParams
): Promise<RequestResponse<T>> {
  return api.post<T>(await _prepareParams(params));
}
export async function del<T>(
  params: AuthenticatedRequestParams
): Promise<RequestResponse<T>> {
  return api.del<T>(await _prepareParams(params));
}

export async function getToken(
  credentialType: CredentialType
): Promise<string> {
  const credential = await _ensureStreamToken(credentialType);
  return credential.token;
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
