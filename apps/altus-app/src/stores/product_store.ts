import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import api from '@/tools/api';
import { deepEqual } from '@/tools/deep_equal';
import { errorLog, log } from '@/tools/log';
import Storage from '@/tools/storage';

import { addListener as addGameListener, getList } from './game_store';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
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

type StorageData = Record<string, CachedProduct>;

const g_cache = new Map<string, CachedProduct>();
let g_requestInFlight = false;
const g_pendingIds: string[] = [];
let g_loaded = false;
let g_flushResolvers: Array<() => void> = [];

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
  addGameListener(_onGameListChange);
}

function _onGameListChange() {
  const titles = getList();
  if (!titles) {
    return;
  }
  void fetchForTitles(titles);
}

export function fetchForTitles(
  titles: Array<{ details: { productId: string } }>
): Promise<void> {
  const missing: string[] = [];
  for (const t of titles) {
    const key = t.details.productId.toUpperCase();
    const cached = g_cache.get(key);
    if (!cached || !_isCacheValid(cached)) {
      missing.push(key);
    }
  }
  if (missing.length === 0) {
    return Promise.resolve();
  }
  // Deduplicate against already-pending ids
  const pendingSet = new Set(g_pendingIds);
  const newIds = missing.filter((id) => !pendingSet.has(id));
  if (newIds.length === 0) {
    // Already queued — wait for current flush cycle to complete
    return new Promise((resolve) => {
      g_flushResolvers.push(resolve);
    });
  }
  g_pendingIds.push(...newIds);
  return new Promise((resolve) => {
    g_flushResolvers.push(resolve);
    void _flush();
  });
}

async function _flush() {
  if (g_requestInFlight || g_pendingIds.length === 0) {
    return;
  }

  const batch = g_pendingIds.splice(0, BATCH_SIZE);
  g_requestInFlight = true;

  log('product_store: Requesting', batch.length, 'products from catalog');
  try {
    const result = await api.post<CatalogResponse>({
      url: 'https://catalog.gamepass.com/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0',
      headers: {
        'ms-cv': '0',
        'calling-app-name': 'Xbox Cloud Gaming Web',
        'calling-app-version': '21.0.0',
      },
      body: { Products: batch },
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
        const entry: CachedProduct = { fetchTime: now, productInfo: info };
        g_cache.set(product.StoreId, entry);
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
    } else {
      errorLog(
        'product_store: Catalog request failed',
        result.err?.message,
        'statusCode:',
        result.statusCode
      );
    }

    _emit();
    void _save();
  } catch (e) {
    errorLog('product_store: Catalog request error', e);
  }

  g_requestInFlight = false;

  if (g_pendingIds.length > 0) {
    await _flush();
  } else {
    const resolvers = g_flushResolvers;
    g_flushResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
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

export function getProductInfo(productId: string): ProductInfo | null {
  const key = productId.toUpperCase();
  const cached = g_cache.get(key);
  if (cached && _isCacheValid(cached)) {
    return cached.productInfo;
  }
  return null;
}

interface Searchable {
  titleId: string;
  details: { productId: string };
}

let g_searchResultCache: Searchable[] | null = null;

export function searchResult<T extends Searchable>(
  titles: T[] | null,
  search: string
): T[] | null {
  if (titles === null) {
    return null;
  }
  if (!search.trim()) {
    return titles;
  }
  const term = search.trim().toLowerCase();
  const result = titles.filter((t) => {
    const info = getProductInfo(t.details.productId);
    const name = info?.productTitle ?? t.titleId;
    return name.toLowerCase().includes(term);
  });
  if (deepEqual(result, g_searchResultCache)) {
    return g_searchResultCache as T[];
  }
  g_searchResultCache = result;
  return result;
}

export function useSearchResult<T extends Searchable>(
  titles: T[] | null,
  search: string
): T[] | null {
  return useSyncExternalStore(_subscribe, () => searchResult(titles, search));
}

export function isLoaded(): boolean {
  return g_loaded;
}

export default {
  init,
  fetchForTitles,
  useProductInfo,
  getProductInfo,
  searchResult,
  useSearchResult,
  isLoaded,
};
