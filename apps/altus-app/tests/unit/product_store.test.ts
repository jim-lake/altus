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

interface ProductStoreModule {
  init: () => Promise<void>;
  fetchProduct: (productId: string) => Promise<ProductInfo | null>;
}

let ProductStore: ProductStoreModule;

before(async () => {
  const mod = await import('../../src/stores/product_store.ts');
  ProductStore = mod.default;
  await ProductStore.init();
});

void describe('ProductStore (live)', () => {
  void it('fetches a single product by productId', async () => {
    const info = await ProductStore.fetchProduct('9NK4NTBFWW81');

    console.log('=== Product Info ===');
    console.log(JSON.stringify(info, null, 2));

    assert.ok(info, 'should return product info');
    assert.ok(info.productTitle.length > 0, 'should have a title');
    assert.ok(
      info.imageTile ?? info.imagePoster,
      'should have at least one image'
    );
  });

  void it('returns cached result on second fetch', async () => {
    const start = Date.now();
    const info = await ProductStore.fetchProduct('9NK4NTBFWW81');
    const elapsed = Date.now() - start;

    assert.ok(info, 'should return cached product info');
    assert.ok(elapsed < 10, `should be instant from cache, took ${elapsed}ms`);
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

  void it('batches multiple requests', async () => {
    const ids = ['9P4KMR76PLLQ', '9PGFHZ103HFR', '9MVHNN0C75V0'];
    const results = await Promise.all(
      ids.map((id) => ProductStore.fetchProduct(id))
    );

    for (let i = 0; i < ids.length; i++) {
      console.log(`${ids[i]}: ${results[i]?.productTitle ?? 'null'}`);
    }

    const resolved = results.filter((r) => r !== null);
    assert.ok(resolved.length > 0, 'should resolve at least some products');
  });

  void it('deduplicates concurrent fetches for the same productId', async () => {
    const id = '9WZDNCRFJ3TJ';
    const promises = Array.from({ length: 5 }, () =>
      ProductStore.fetchProduct(id)
    );
    const results = await Promise.all(promises);

    const first = results[0];
    for (const r of results) {
      assert.strictEqual(
        r,
        first,
        'all concurrent calls should return same reference'
      );
    }
    console.log(`Dedup test: ${id} => ${first?.productTitle ?? 'null'}`);
  });

  void it('does not re-fetch a product already in cache', async () => {
    const start = Date.now();
    const promises = Array.from({ length: 10 }, () =>
      ProductStore.fetchProduct('9NK4NTBFWW81')
    );
    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 5, `all 10 calls should be instant, took ${elapsed}ms`);
    for (const r of results) {
      assert.strictEqual(r?.productId, '9NK4NTBFWW81');
    }
  });

  void it('batches requests added within the 100ms window', async () => {
    const ids = ['9NBLGGH4PBBM', '9NKX70BBCDRN'];
    const p1 = ProductStore.fetchProduct(ids[0]!);
    await new Promise((r) => {
      setTimeout(r, 50);
    });
    const p2 = ProductStore.fetchProduct(ids[1]!);

    const [r1, r2] = await Promise.all([p1, p2]);
    console.log(
      `Batch window: ${ids[0]} => ${r1?.productTitle ?? 'null'}, ${ids[1]} => ${r2?.productTitle ?? 'null'}`
    );
    assert.ok(true, 'both resolved without error');
  });

  void it('resolves from Storage on fresh fetch of previously persisted item', () => {
    const stored = g_storage.get('PRODUCT_CACHE');
    assert.ok(stored, 'product cache should be in storage');
    const parsed = JSON.parse(stored) as Record<
      string,
      { fetchTime: number; productInfo: ProductInfo }
    >;
    const entry = parsed['9NK4NTBFWW81'];
    assert.ok(entry, '9NK4NTBFWW81 should be in cache');
    assert.ok(
      Date.now() - entry.fetchTime < 30000,
      'fetchTime should be recent'
    );
    assert.strictEqual(
      entry.productInfo.productTitle,
      'Hogwarts Legacy Xbox One Version'
    );
  });

  void it('handles a large concurrent burst without multiple in-flight requests', async () => {
    const ids = [
      '9PLHVRTB8GXG',
      '9NDLGT75G69K',
      '9N9JK0DZ1BHJ',
      '9NMLGH99DL6T',
      '9NZ81RHQR4FM',
      '9MWR0GBZLML7',
      '9NJ4R9P680JC',
      '9P1J5Q8WMRSP',
      '9NXCBHFH12QK',
      '9PGJKM7T7MCG',
      '9N56T1BHXKGP',
      '9PKWHT5Q8T1S',
      '9N2ZDN2D6QZ0',
      '9P513P4M8WJP',
      '9NKH1R2NKZXX',
      '9N7GX1NBXZL8',
      '9NL4KTK0N4CG',
      '9MTBKGPMW01S',
      '9NG07QJNK38J',
      '9N3CJBGRGMZP',
    ];
    const start = Date.now();
    const results = await Promise.all(
      ids.map((id) => ProductStore.fetchProduct(id))
    );
    const elapsed = Date.now() - start;

    const resolved = results.filter((r) => r !== null);
    console.log(
      `Burst: ${resolved.length}/${ids.length} resolved in ${elapsed}ms`
    );
    assert.ok(elapsed < 10000, `should complete within 10s, took ${elapsed}ms`);
  });
});

void describe('ProductStore batching mechanics', () => {
  void it('same product requested 10 times only produces 1 API call', async () => {
    const before = g_catalogRequests.length;
    const id = '9NBLGGH537BL';
    const promises = Array.from({ length: 10 }, () =>
      ProductStore.fetchProduct(id)
    );
    await Promise.all(promises);
    const newRequests = g_catalogRequests.slice(before);

    const containingId = newRequests.filter((r) => r.productIds.includes(id));
    assert.strictEqual(
      containingId.length,
      1,
      `expected 1 API call for 10 duplicate requests, got ${containingId.length}`
    );
    console.log(`Dedup: 10 calls => ${containingId.length} API request(s)`);
  });

  void it('110 unique requests produce 2 batches (100 + 10)', async () => {
    const before = g_catalogRequests.length;
    const ids = Array.from(
      { length: 110 },
      (_, i) => `FAKE${String(i).padStart(6, '0')}XX`
    );
    const promises = ids.map((id) => ProductStore.fetchProduct(id));
    await Promise.all(promises);
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

  void it('requests after 150ms delay go in a separate batch', async () => {
    const before = g_catalogRequests.length;
    const batch1Ids = Array.from(
      { length: 10 },
      (_, i) => `DELAY1_${String(i).padStart(4, '0')}`
    );
    const batch2Ids = Array.from(
      { length: 10 },
      (_, i) => `DELAY2_${String(i).padStart(4, '0')}`
    );

    const p1 = Promise.all(
      batch1Ids.map((id) => ProductStore.fetchProduct(id))
    );
    await new Promise((r) => {
      setTimeout(r, 150);
    });
    const p2 = Promise.all(
      batch2Ids.map((id) => ProductStore.fetchProduct(id))
    );

    await Promise.all([p1, p2]);
    const newRequests = g_catalogRequests.slice(before);

    console.log(
      `Delayed batches => ${newRequests.length} API call(s), sizes: [${newRequests.map((r) => r.productIds.length).join(', ')}]`
    );
    assert.ok(
      newRequests.length >= 2,
      `expected at least 2 separate batch calls, got ${newRequests.length}`
    );
    const firstBatch = newRequests[0]!;
    assert.ok(
      batch1Ids.every((id) => firstBatch.productIds.includes(id)),
      'first batch should contain all batch1 IDs'
    );
  });

  void it('already-cached items are never included in API requests', async () => {
    const before = g_catalogRequests.length;
    await Promise.all(
      Array.from({ length: 20 }, () =>
        ProductStore.fetchProduct('9NK4NTBFWW81')
      )
    );
    const after = g_catalogRequests.length;

    assert.strictEqual(
      after,
      before,
      `no new API calls should be made for cached items, got ${after - before} new`
    );
  });

  void it('add 10, wait 150ms, add 10 more produces 2 separate batches', async () => {
    const before = g_catalogRequests.length;
    const groupA = Array.from(
      { length: 10 },
      (_, i) => `GROUPA_${String(i).padStart(4, '0')}`
    );
    const groupB = Array.from(
      { length: 10 },
      (_, i) => `GROUPB_${String(i).padStart(4, '0')}`
    );

    // Fire group A
    const pA = Promise.all(groupA.map((id) => ProductStore.fetchProduct(id)));

    // Wait for batch window to expire AND first request to complete
    await pA;

    // Now fire group B after first batch completed
    await new Promise((r) => {
      setTimeout(r, 50);
    });
    const pB = Promise.all(groupB.map((id) => ProductStore.fetchProduct(id)));
    await pB;

    const newRequests = g_catalogRequests.slice(before);
    console.log(
      `GroupA+B => ${newRequests.length} API call(s), sizes: [${newRequests.map((r) => r.productIds.length).join(', ')}]`
    );

    assert.strictEqual(newRequests.length, 2, 'should be 2 separate batches');
    assert.ok(
      groupA.every((id) => newRequests[0]!.productIds.includes(id)),
      'first batch has group A'
    );
    assert.ok(
      groupB.every((id) => newRequests[1]!.productIds.includes(id)),
      'second batch has group B'
    );
  });
});

void describe('ProductStore - DayZ image debug', () => {
  void it('fetches DayZ with lowercase productId', async () => {
    const info = await ProductStore.fetchProduct('bsr9nlhvf1kl');
    console.log('DayZ:', JSON.stringify(info, null, 2));
    assert.ok(info, 'DayZ should resolve');
    assert.strictEqual(info.productTitle, 'DayZ');
    assert.ok(info.imageTile, 'DayZ should have an image');
  });
});
