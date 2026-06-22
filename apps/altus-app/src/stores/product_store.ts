import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import api from '@/tools/api';
import { errorLog, log } from '@/tools/log';
import Storage from '@/tools/storage';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
const BATCH_DELAY = 100;
const BATCH_SIZE = 100;
const STORAGE_KEY = 'PRODUCT_CACHE';

export interface ProductInfo {
  productId: string;
  productTitle: string;
  publisherName: string;
  imageTile: string | null;
  imagePoster: string | null;
}

interface CachedProduct {
  fetchTime: number;
  productInfo: ProductInfo;
}

interface CatalogResponse {
  Products: Record<
    string,
    {
      ProductTitle: string;
      PublisherName: string;
      Image_Tile: { URL: string } | null;
      Image_Poster: { URL: string } | null;
      StoreId: string;
    }
  >;
  InvalidIds?: string[];
}

interface PendingRequest {
  productId: string;
  resolve: (info: ProductInfo | null) => void;
}

type StorageData = Record<string, CachedProduct>;

const g_cache = new Map<string, CachedProduct>();
const g_inflight = new Set<string>();
const g_pendingQueue: PendingRequest[] = [];
let g_batchTimer: ReturnType<typeof setTimeout> | null = null;
let g_requestInFlight = false;
let g_loaded = false;

const g_eventEmitter = new EventEmitter();
g_eventEmitter.setMaxListeners(1000);
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

function _isCacheValid(entry: CachedProduct): boolean {
  return Date.now() - entry.fetchTime < CACHE_TTL;
}

export async function init() {
  const result = await Storage.getItem<StorageData>(STORAGE_KEY);
  if (result.err) {
    errorLog('product_store: Storage load error', result.err);
  } else if (result.value) {
    const now = Date.now();
    let loaded = 0;
    for (const [key, entry] of Object.entries(result.value)) {
      if (now - entry.fetchTime < CACHE_TTL) {
        g_cache.set(key, entry);
        loaded++;
      }
    }
    log('product_store: Loaded', loaded, 'products from storage');
  }
  g_loaded = true;
  _emit();
}

async function _save() {
  const data: StorageData = {};
  for (const [key, entry] of g_cache) {
    if (_isCacheValid(entry)) {
      data[key] = entry;
    }
  }
  await Storage.setItem({ key: STORAGE_KEY, value: data });
}

function _scheduleBatch() {
  if (g_batchTimer !== null) {
    return;
  }
  g_batchTimer = setTimeout(() => {
    g_batchTimer = null;
    void _flush();
  }, BATCH_DELAY);
}

async function _flush() {
  if (g_requestInFlight || g_pendingQueue.length === 0) {
    return;
  }

  const batch = g_pendingQueue.splice(0, BATCH_SIZE);
  g_requestInFlight = true;

  const productIds = batch.map((r) => r.productId);
  log('product_store: Requesting', productIds.length, 'products from catalog');
  try {
    const result = await api.post<CatalogResponse>({
      url: 'https://catalog.gamepass.com/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0',
      headers: {
        'ms-cv': '0',
        'calling-app-name': 'Xbox Cloud Gaming Web',
        'calling-app-version': '21.0.0',
      },
      body: { Products: productIds },
    });

    const now = Date.now();
    if (!result.err && result.body?.Products) {
      for (const [, product] of Object.entries(result.body.Products)) {
        if (!product.StoreId) {
          errorLog('product_store: Product missing StoreId', product);
          continue;
        }
        const info: ProductInfo = {
          productId: product.StoreId,
          productTitle: product.ProductTitle ?? '',
          publisherName: product.PublisherName ?? '',
          imageTile: product.Image_Tile?.URL ?? null,
          imagePoster: product.Image_Poster?.URL ?? null,
        };
        if (!info.imageTile) {
          errorLog(
            'product_store: No tile image for',
            product.StoreId,
            product.ProductTitle
          );
        }
        const entry: CachedProduct = { fetchTime: now, productInfo: info };
        g_cache.set(product.StoreId, entry);
        g_inflight.delete(product.StoreId);
      }
      log(
        'product_store: Fetched',
        Object.keys(result.body.Products).length,
        'products'
      );
      if (result.body.InvalidIds && result.body.InvalidIds.length > 0) {
        errorLog(
          'product_store: InvalidIds from catalog:',
          result.body.InvalidIds.length,
          result.body.InvalidIds.slice(0, 10)
        );
      }
      const returnedIds = new Set(
        Object.values(result.body.Products).map((p) => p.StoreId)
      );
      const invalidIds = new Set(result.body.InvalidIds ?? []);
      const missingIds = productIds.filter(
        (id) => !returnedIds.has(id) && !invalidIds.has(id)
      );
      if (missingIds.length > 0) {
        errorLog(
          'product_store: Products not returned by catalog:',
          missingIds.length,
          missingIds.slice(0, 10)
        );
      }
    } else {
      errorLog(
        'product_store: Catalog request failed',
        result.err?.message,
        'statusCode:',
        result.statusCode
      );
    }

    // Resolve all pending promises
    for (const req of batch) {
      const cached = g_cache.get(req.productId);
      if (!cached?.productInfo) {
        errorLog('product_store: Failed to get info for', req.productId);
      }
      req.resolve(cached?.productInfo ?? null);
      g_inflight.delete(req.productId);
    }
    _emit();
    void _save();
  } catch (e) {
    errorLog('product_store: Catalog request error', e);
    for (const req of batch) {
      req.resolve(null);
      g_inflight.delete(req.productId);
    }
  }

  g_requestInFlight = false;

  if (g_pendingQueue.length > 0) {
    void _flush();
  }
}

export function fetchProduct(productId: string): Promise<ProductInfo | null> {
  const key = productId.toUpperCase();
  const cached = g_cache.get(key);
  if (cached && _isCacheValid(cached)) {
    return Promise.resolve(cached.productInfo);
  }

  if (g_inflight.has(key)) {
    return new Promise((resolve) => {
      g_pendingQueue.push({ productId: key, resolve });
    });
  }

  g_inflight.add(key);
  return new Promise((resolve) => {
    g_pendingQueue.push({ productId: key, resolve });
    _scheduleBatch();
  });
}

export function useProductInfo(productId: string): ProductInfo | null {
  const key = productId.toUpperCase();
  return useSyncExternalStore(_subscribe, () => {
    const cached = g_cache.get(key);
    if (cached && _isCacheValid(cached)) {
      return cached.productInfo;
    }
    return null;
  });
}

export function isLoaded(): boolean {
  return g_loaded;
}

export default { init, fetchProduct, useProductInfo, isLoaded };
