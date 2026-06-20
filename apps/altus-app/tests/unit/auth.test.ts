import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

import type { DeviceCodeResponse } from '../../src/lib/auth.ts';

// Shim XMLHttpRequest for Node.js
class XMLHttpRequestShim {
  method = '';
  url = '';
  timeout = 0;
  status = 0;
  responseText = '';
  private _headers: Record<string, string> = {};
  private _responseHeaders: Record<string, string> = {};
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this._headers[key.toLowerCase()] = value;
  }

  getAllResponseHeaders() {
    return Object.entries(this._responseHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
  }

  send(body?: string | Blob | FormData | null) {
    const parsed = new URL(this.url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      method: this.method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: this._headers,
      timeout: this.timeout || undefined,
    };

    const doRequest = (payload: string | null) => {
      const req = mod.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          this.status = res.statusCode ?? 0;
          this.responseText = data;
          this._responseHeaders = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) {
              this._responseHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
            }
          }
          this.onload?.();
        });
      });

      req.on('error', () => {
        this.onerror?.();
      });
      req.on('timeout', () => {
        req.destroy();
        this.ontimeout?.();
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    };

    if (body instanceof Blob) {
      void body.text().then((text) => {
        doRequest(text);
      });
    } else {
      doRequest(typeof body === 'string' ? body : null);
    }
  }
}

(
  globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequestShim }
).XMLHttpRequest = XMLHttpRequestShim;

interface AuthModule {
  startDeviceCodeAuth: () => Promise<DeviceCodeResponse>;
}

let auth: AuthModule;

before(async () => {
  auth = await import('../../src/lib/auth.ts');
});

void describe('auth - startDeviceCodeAuth (live)', () => {
  void it('retrieves a valid device code from Microsoft', async () => {
    const result = await auth.startDeviceCodeAuth();

    console.log('=== Device Code Response ===');
    console.log('user_code:', result.user_code);
    console.log('device_code:', result.device_code.slice(0, 20) + '...');
    console.log('verification_uri:', result.verification_uri);
    console.log('expires_in:', result.expires_in);
    console.log('interval:', result.interval);
    console.log('message:', result.message);
    console.log('============================');

    assert.ok(result.user_code, 'user_code must be present');
    assert.ok(
      result.device_code.length > 10,
      'device_code must be a real token'
    );
    assert.ok(
      result.verification_uri.includes('microsoft'),
      'verification_uri must be a microsoft URL'
    );
    assert.ok(result.expires_in > 0, 'expires_in must be positive');
    assert.ok(result.interval >= 1, 'interval must be at least 1 second');
  });
});
