import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { URL } from 'node:url';

import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const EXPIRES_AT = process.env.EXPIRES_AT;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

assert.ok(ACCESS_TOKEN, 'ACCESS_TOKEN must be set in .env');
assert.ok(EXPIRES_AT, 'EXPIRES_AT must be set in .env');
assert.ok(REFRESH_TOKEN, 'REFRESH_TOKEN must be set in .env');

// Shim AsyncStorage
const g_storage = new Map<string, string>();
g_storage.set(
  'ALTUS_TOKEN_KEY',
  JSON.stringify({
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: Number(EXPIRES_AT),
  })
);

const require = createRequire(import.meta.url);
const asyncStoragePath =
  require.resolve('@react-native-async-storage/async-storage');
require.cache[asyncStoragePath] = {
  id: asyncStoragePath,
  filename: asyncStoragePath,
  loaded: true,
  exports: {
    __esModule: true,
    default: {
      getItem: (key: string) => Promise.resolve(g_storage.get(key) ?? null),
      setItem: (key: string, value: string) => {
        g_storage.set(key, value);
        return Promise.resolve();
      },
    },
  },
} as NodeModule;

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

    const doRequest = (payload: string | null) => {
      const headers: Record<string, string> = { ...this._headers };
      if (payload) {
        headers['content-length'] = String(Buffer.byteLength(payload));
      }
      const options = {
        method: this.method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers,
        timeout: this.timeout || undefined,
      };

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

interface UserStoreModule {
  init: () => Promise<void>;
  isLoggedIn: () => boolean;
}

let UserStore: UserStoreModule;

before(async () => {
  const userMod = await import('../../src/stores/user_store.ts');
  UserStore = userMod.default;
  await UserStore.init();
  assert.ok(UserStore.isLoggedIn(), 'must be logged in to run this test');
});

void describe('Title playability', () => {
  void it('splits titles into playable and unplayable and logs counts', async () => {
    const { getTitles, isTitlePlayable } =
      await import('../../src/lib/xcloud_api.ts');
    const titles = await getTitles();
    assert.ok(titles.length > 0, 'should have at least one title');

    const playable = titles.filter(isTitlePlayable);
    const unplayable = titles.filter((t) => !isTitlePlayable(t));

    console.log(`=== Title Playability ===`);
    console.log(`Total titles: ${titles.length}`);
    console.log(`Playable: ${playable.length}`);
    console.log(`Unplayable: ${unplayable.length}`);

    if (unplayable.length > 0) {
      console.log('Sample unplayable:', JSON.stringify(unplayable[0], null, 2));
    }
    if (playable.length > 0) {
      console.log('Sample playable:', JSON.stringify(playable[0], null, 2));
    }

    assert.strictEqual(
      playable.length + unplayable.length,
      titles.length,
      'playable + unplayable should equal total'
    );
  });
});
