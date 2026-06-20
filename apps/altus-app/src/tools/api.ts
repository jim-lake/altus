import { retry } from './retry';
import Storage from './storage';

import { errorLog } from './log';

import type { JSONObject } from './json';

export class ApiError extends Error {
  readonly statusCode: number | null;
  constructor(message: string, statusCode?: number | null) {
    super(message);
    this.statusCode = statusCode ?? null;
  }
}

export default {
  init,
  isReady,
  getCustomBaseUrl,
  setCustomBaseUrl,
  getBaseUrl,
  get,
  post,
  put,
  del,
  cdnGet,
  request,
  rawRequest,
  ApiError,
};

export interface RequestParams {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  timeout?: number;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string | string[]>;
  body?: FormData | Blob | object;
  retry?: number | boolean;
  maxRetryInterval?: number;
}

export interface RawRequestErrorResponse<T = JSONObject> {
  err: ApiError;
  body: T | null;
  text: string | null;
  headers: Map<string, string>;
  statusCode: number | null;
}
export interface RawRequestSuccessResponse<T = JSONObject> {
  err: null;
  body: T;
  text: string | null;
  headers: Map<string, string>;
  statusCode: number;
}
export type RequestResponse<T = JSONObject> =
  | RawRequestSuccessResponse<T>
  | RawRequestErrorResponse<T>;

const DEFAULT_TIMEOUT = 10 * 1000;
const MAX_RETRY_INTERVAL = 60 * 1000;
const CUSTOM_BASE_URL_KEY = 'LBB_CUSTOM_BASE_URL';

const DEV_BASE_URL = REMOTE_SERVER;
const DEV_BASE_CDN_URL = REMOTE_SERVER;
//const DEV_BASE_URL = 'https://api-prod.lbb-dev.com';
//const DEV_BASE_CDN_URL = 'https://api-prod-cdn.lbb-dev.com';
//const PROD_BASE_URL = 'https://api-prod.lbb-dev.com';
//const PROD_BASE_CDN_URL = 'https://api-prod-cdn.lbb-dev.com';

let g_baseUrl = '';
let g_baseCdnUrl = '';
let g_customBaseUrl = '';
let g_userAgent = '';

export async function init(): Promise<void> {
  g_baseUrl = DEV_BASE_URL;
  g_baseCdnUrl = DEV_BASE_CDN_URL;
}

export function isReady(): boolean {
  return true;
}
export function getCustomBaseUrl(): string {
  return g_customBaseUrl;
}
export function setCustomBaseUrl(url: string): void {
  if (!url) {
    g_customBaseUrl = '';
  } else {
    url = url.replace(/\/*$/, '');
    g_customBaseUrl = url;
  }
  Storage.setItem({ key: CUSTOM_BASE_URL_KEY, value: g_customBaseUrl });
}

export function getBaseUrl(): string {
  return g_customBaseUrl ? g_customBaseUrl : g_baseUrl;
}
export function getCdnUrl(): string {
  return g_customBaseUrl ? g_customBaseUrl : g_baseCdnUrl;
}

export async function get<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  params.method = 'GET';
  return request<T>(params);
}
export async function post<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  params.method = 'POST';
  return request<T>(params);
}
export async function put<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  params.method = 'PUT';
  return request<T>(params);
}
export async function del<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  params.method = 'DELETE';
  return request<T>(params);
}
export function request<T>(params: RequestParams): Promise<RequestResponse<T>> {
  if (params.url.indexOf('http') !== 0) {
    params.url = getBaseUrl() + params.url;
  }

  if (params.retry) {
    return _requestRetry<T>(params);
  } else {
    return rawRequest<T>(params);
  }
}
async function cdnGet<T>(params: RequestParams): Promise<RequestResponse<T>> {
  params.url = getCdnUrl() + params.url;
  return rawRequest(params);
}
async function _requestRetry<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  const times = typeof params.retry === 'number' ? params.retry : 5;
  const maxRetryInterval = params.maxRetryInterval ?? MAX_RETRY_INTERVAL;
  function interval(count: number) {
    const ret = Math.min(50 * Math.pow(3, count), maxRetryInterval);
    return ret;
  }
  return retry(
    async () => {
      const result = await rawRequest<T>(params);
      if (!result.err) {
        return result;
      }
      if (
        result.statusCode !== null &&
        result.statusCode > 0 &&
        result.statusCode < 500
      ) {
        return result;
      }
      throw new Error('retry');
    },
    { interval, times }
  );
}
export async function rawRequest<T>(
  params: RequestParams
): Promise<RequestResponse<T>> {
  const {
    method = 'GET',
    timeout = DEFAULT_TIMEOUT,
    url,
    query,
    headers: customHeaders = {},
    body: requestBody,
  } = params;

  const default_headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (g_userAgent) {
    default_headers['user-agent'] = g_userAgent;
  }

  let body: FormData | Blob | string | null = null;
  if (requestBody instanceof FormData || requestBody instanceof Blob) {
    body = requestBody;
  } else if (requestBody) {
    body = JSON.stringify(requestBody);
    default_headers['content-type'] = 'application/json';
  }

  let finalUrl: string = url;
  if (query) {
    const qs = Object.entries(query)
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      )
      .join('&');
    if (qs) {
      finalUrl += finalUrl.includes('?') ? `&${qs}` : `?${qs}`;
    }
  }

  const headers: Record<string, string> = { ...default_headers };
  Object.entries(customHeaders).forEach(([name, values]) => {
    const valueArray = Array.isArray(values) ? values : [values];
    headers[name] = valueArray.join(', ');
  });

  return new Promise<RequestResponse<T>>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, finalUrl, true);
    xhr.timeout = timeout;

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    const parseResponse = (): RequestResponse<T> => {
      const statusCode = xhr.status;
      const text = xhr.responseText ?? null;

      const responseHeaders = new Map<string, string>();
      xhr
        .getAllResponseHeaders()
        .trim()
        .split(/\r?\n/)
        .forEach((line) => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            const key = line.slice(0, idx).trim().toLowerCase();
            const value = line.slice(idx + 1).trim();
            responseHeaders.set(key, value);
          }
        });

      const contentType = responseHeaders.get('content-type') ?? '';
      const isJson = contentType.includes('json');

      let jsonBody: T | null = null;
      if (isJson && text) {
        try {
          jsonBody = JSON.parse(text) as T;
        } catch {
          // JSON parse failed, leave jsonBody as null
        }
      }

      const ok = statusCode >= 200 && statusCode < 300;
      if (!ok) {
        return {
          err: new ApiError(String(statusCode), statusCode),
          body: jsonBody as T,
          text,
          headers: responseHeaders,
          statusCode,
        };
      }

      return {
        err: null,
        body: jsonBody as T,
        text,
        headers: responseHeaders,
        statusCode,
      };
    };

    xhr.onload = () => {
      resolve(parseResponse());
    };

    xhr.ontimeout = () => {
      resolve({
        err: new ApiError('timeout'),
        body: null,
        text: null,
        headers: new Map(),
        statusCode: null,
      });
    };

    xhr.onerror = () => {
      errorLog('Api.request failure:', xhr.statusText);
      resolve({
        err: new ApiError('request_failure'),
        body: null,
        text: null,
        headers: new Map(),
        statusCode: null,
      });
    };

    xhr.send(body);
  });
}
