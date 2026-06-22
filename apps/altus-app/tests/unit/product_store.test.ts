import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { URL } from 'node:url';

import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

// Shim AsyncStorage
const g_storage = new Map<string, string>();

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

// Track catalog API calls
const g_catalogRequests: Array<{ productIds: string[]; time: number }> = [];
const OriginalXHR = XMLHttpRequestShim;
class InstrumentedXHR extends OriginalXHR {
  send(body?: string | Blob | FormData | null) {
    if (this.url.includes('catalog.gamepass.com')) {
      const payload = typeof body === 'string' ? body : null;
      if (payload) {
        try {
          const parsed = JSON.parse(payload) as { Products: string[] };
          g_catalogRequests.push({
            productIds: parsed.Products,
            time: Date.now(),
          });
        } catch {
          // ignore
        }
      }
    }
    super.send(body);
  }
}
(
  globalThis as unknown as { XMLHttpRequest: typeof InstrumentedXHR }
).XMLHttpRequest = InstrumentedXHR;

interface ProductInfo {
  productId: string;
  productTitle: string;
  publisherName: string;
  imageTile: string | null;
  imagePoster: string | null;
}

interface Title {
  titleId: string;
  details: { productId: string };
}

interface ProductStoreModule {
  init: () => Promise<void>;
  fetchForTitles: (titles: Title[]) => Promise<void>;
  getProductInfo: (productId: string) => ProductInfo | null;
  searchResult: (titles: Title[] | null, search: string) => Title[] | null;
  isLoaded: () => boolean;
}

function makeTitles(ids: string[]): Title[] {
  return ids.map((id) => ({ titleId: id, details: { productId: id } }));
}

let ProductStore: ProductStoreModule;

before(async () => {
  const mod = await import('../../src/stores/product_store.ts');
  ProductStore = mod.default;
  await ProductStore.init();
});

void describe('ProductStore (live)', () => {
  void it('fetches products for a list of titles', async () => {
    const titles = makeTitles(['9NK4NTBFWW81']);
    await ProductStore.fetchForTitles(titles);

    const info = ProductStore.getProductInfo('9NK4NTBFWW81');
    console.log('=== Product Info ===');
    console.log(JSON.stringify(info, null, 2));

    assert.ok(info, 'should return product info');
    assert.ok(info.productTitle.length > 0, 'should have a title');
    assert.ok(
      info.imageTile ?? info.imagePoster,
      'should have at least one image'
    );
  });

  void it('returns cached result without re-fetching', async () => {
    const before = g_catalogRequests.length;
    const titles = makeTitles(['9NK4NTBFWW81']);
    await ProductStore.fetchForTitles(titles);
    const after = g_catalogRequests.length;

    const info = ProductStore.getProductInfo('9NK4NTBFWW81');
    assert.ok(info, 'should return cached product info');
    assert.strictEqual(after, before, 'should not make a new API call');
  });

  void it('persists to Storage and retrieves', () => {
    const stored = g_storage.get('PRODUCT_CACHE');
    assert.ok(stored, 'should have persisted to storage');
    const parsed = JSON.parse(stored) as Record<
      string,
      { fetchTime: number; productInfo: ProductInfo }
    >;
    assert.ok(parsed['9NK4NTBFWW81'], 'should contain 9NK4NTBFWW81');
    assert.strictEqual(
      parsed['9NK4NTBFWW81'].productInfo.productId,
      '9NK4NTBFWW81'
    );
  });

  void it('batches multiple titles in one request', async () => {
    const ids = ['9P4KMR76PLLQ', '9PGFHZ103HFR', '9MVHNN0C75V0'];
    const before = g_catalogRequests.length;
    await ProductStore.fetchForTitles(makeTitles(ids));
    const newRequests = g_catalogRequests.slice(before);

    for (const id of ids) {
      const info = ProductStore.getProductInfo(id);
      console.log(`${id}: ${info?.productTitle ?? 'null'}`);
    }

    assert.strictEqual(newRequests.length, 1, 'should be a single API call');
    const resolved = ids.filter(
      (id) => ProductStore.getProductInfo(id) !== null
    );
    assert.ok(resolved.length > 0, 'should resolve at least some products');
  });

  void it('deduplicates same productId in the list', async () => {
    const id = '9WZDNCRFJ3TJ';
    const titles = makeTitles(Array.from({ length: 5 }, () => id));
    const before = g_catalogRequests.length;
    await ProductStore.fetchForTitles(titles);
    const newRequests = g_catalogRequests.slice(before);

    const containingId = newRequests.filter((r) =>
      r.productIds.includes(id.toUpperCase())
    );
    assert.ok(
      containingId.length <= 1,
      `should produce at most 1 API call, got ${containingId.length}`
    );
    const info = ProductStore.getProductInfo(id);
    console.log(`Dedup test: ${id} => ${info?.productTitle ?? 'null'}`);
  });

  void it('does not re-fetch products already in cache', async () => {
    const before = g_catalogRequests.length;
    await ProductStore.fetchForTitles(makeTitles(['9NK4NTBFWW81']));
    const after = g_catalogRequests.length;

    assert.strictEqual(after, before, 'no new API calls for cached items');
  });
});

void describe('ProductStore batching mechanics', () => {
  void it('110 unique titles produce 2 batches (100 + 10)', async () => {
    const before = g_catalogRequests.length;
    const ids = Array.from(
      { length: 110 },
      (_, i) => `FAKE${String(i).padStart(6, '0')}XX`
    );
    await ProductStore.fetchForTitles(makeTitles(ids));
    const newRequests = g_catalogRequests.slice(before);

    console.log(
      `110 requests => ${newRequests.length} API call(s), sizes: [${newRequests.map((r) => r.productIds.length).join(', ')}]`
    );
    assert.strictEqual(
      newRequests.length,
      2,
      `expected 2 batch calls, got ${newRequests.length}`
    );
    assert.strictEqual(
      newRequests[0]!.productIds.length,
      100,
      'first batch should be 100'
    );
    assert.strictEqual(
      newRequests[1]!.productIds.length,
      10,
      'second batch should be 10'
    );
  });

  void it('already-cached items are never included in API requests', async () => {
    const before = g_catalogRequests.length;
    await ProductStore.fetchForTitles(makeTitles(['9NK4NTBFWW81']));
    const after = g_catalogRequests.length;

    assert.strictEqual(
      after,
      before,
      `no new API calls should be made for cached items, got ${after - before} new`
    );
  });

  void it('single request in flight - concurrent calls queue', async () => {
    const before = g_catalogRequests.length;
    const groupA = Array.from(
      { length: 10 },
      (_, i) => `SINGLEFLIGHT_A_${String(i).padStart(4, '0')}`
    );
    const groupB = Array.from(
      { length: 10 },
      (_, i) => `SINGLEFLIGHT_B_${String(i).padStart(4, '0')}`
    );

    // Fire both concurrently — second should queue behind first
    const pA = ProductStore.fetchForTitles(makeTitles(groupA));
    const pB = ProductStore.fetchForTitles(makeTitles(groupB));
    await Promise.all([pA, pB]);

    const newRequests = g_catalogRequests.slice(before);
    console.log(
      `Concurrent => ${newRequests.length} API call(s), sizes: [${newRequests.map((r) => r.productIds.length).join(', ')}]`
    );
    // Should be at most 2 sequential batches (single in-flight)
    assert.ok(
      newRequests.length >= 1 && newRequests.length <= 2,
      `expected 1-2 sequential batch calls, got ${newRequests.length}`
    );
  });

  void it('handles a large burst without multiple concurrent in-flight requests', async () => {
    const ids = Array.from(
      { length: 200 },
      (_, i) => `BURST_${String(i).padStart(6, '0')}`
    );
    const before = g_catalogRequests.length;
    await ProductStore.fetchForTitles(makeTitles(ids));
    const newRequests = g_catalogRequests.slice(before);

    console.log(
      `Burst 200: ${newRequests.length} API call(s), sizes: [${newRequests.map((r) => r.productIds.length).join(', ')}]`
    );
    // 200 ids should produce 2 sequential batches of 100
    assert.strictEqual(newRequests.length, 2, 'should produce 2 batches');
    assert.strictEqual(newRequests[0]!.productIds.length, 100);
    assert.strictEqual(newRequests[1]!.productIds.length, 100);
  });
});

void describe('ProductStore - DayZ image debug', () => {
  void it('fetches DayZ with lowercase productId', async () => {
    await ProductStore.fetchForTitles(makeTitles(['bsr9nlhvf1kl']));
    const info = ProductStore.getProductInfo('bsr9nlhvf1kl');
    console.log('DayZ:', JSON.stringify(info, null, 2));
    assert.ok(info, 'DayZ should resolve');
    assert.strictEqual(info.productTitle, 'DayZ');
    assert.ok(info.imageTile, 'DayZ should have an image');
  });
});

void describe('ProductStore - searchResult', () => {
  void it('returns all titles when search is empty', async () => {
    const titles = makeTitles(['9NK4NTBFWW81', '9P4KMR76PLLQ']);
    await ProductStore.fetchForTitles(titles);
    const result = ProductStore.searchResult(titles, '');
    assert.strictEqual(
      result,
      titles,
      'should return the same array reference'
    );
  });

  void it('returns null when titles is null', () => {
    const result = ProductStore.searchResult(null, 'test');
    assert.strictEqual(result, null);
  });

  void it('filters titles by product name', async () => {
    const titles = makeTitles(['9NK4NTBFWW81', 'BSR9NLHVF1KL']);
    await ProductStore.fetchForTitles(titles);
    const result = ProductStore.searchResult(titles, 'dayz');
    assert.ok(result, 'should return a result');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.details.productId, 'BSR9NLHVF1KL');
  });

  void it('falls back to titleId when product info is missing', () => {
    const titles: Title[] = [
      { titleId: 'UNKNOWN_GAME_XYZ', details: { productId: 'NOTEXIST123' } },
    ];
    const result = ProductStore.searchResult(titles, 'UNKNOWN_GAME');
    assert.ok(result, 'should return a result');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.titleId, 'UNKNOWN_GAME_XYZ');
  });

  void it('is case-insensitive', async () => {
    const titles = makeTitles(['9NK4NTBFWW81']);
    await ProductStore.fetchForTitles(titles);
    const result = ProductStore.searchResult(titles, 'HOGWARTS');
    assert.ok(result, 'should return a result');
    assert.strictEqual(result.length, 1);
  });
});
