import { get } from '@/stores/user_store';
import { errorLog, log } from '@/tools/log';

import type { RequestResponse } from '@/tools/api';

export interface Console {
  deviceName: string;
  serverId: string;
  powerState: string;
  consoleType: string;
  playPath: string;
  outOfHomeWarning: boolean;
  wirelessWarning: boolean;
  isDevKit: boolean;
}

interface ConsolesResponse {
  totalItems: number;
  results: Console[];
}

export interface Title {
  titleId: string;
  details: {
    productId: string;
    xboxTitleId: number;
    hasEntitlement: boolean;
    supportsInAppPurchases: boolean;
    isFreeInStore: boolean;
    maxSessionLengthInSeconds: number;
    supportedTabs: string[] | null;
    supportedInputTypes: string[];
    programs: string[];
    userPrograms: string[];
    userSubscriptions: string[];
    earlyAccessProductIds: string[];
    maxGamepass: boolean;
  };
}

export function isTitlePlayable(title: Title): boolean {
  return title.details.userPrograms.length > 0 || title.details.hasEntitlement;
}

interface TitlesResponse {
  totalItems: number;
  results: Title[];
}

export async function getConsoles(): Promise<Console[]> {
  log('xcloud_api: Fetching consoles');
  const result: RequestResponse<ConsolesResponse> = await get({
    url: '/v6/servers/home',
    credentialType: 'xHome',
  });
  if (result.err) {
    errorLog(
      'xcloud_api: getConsoles failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  log('xcloud_api: Got', result.body.results.length, 'consoles');
  return result.body.results;
}

export async function getTitles(): Promise<Title[]> {
  log('xcloud_api: Fetching titles');
  const result: RequestResponse<TitlesResponse> = await get({
    url: '/v2/titles',
    credentialType: 'xgpuweb',
  });
  if (result.err) {
    errorLog(
      'xcloud_api: getTitles failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  log('xcloud_api: Got', result.body.results.length, 'titles');
  return result.body.results;
}

export async function getRecentTitles(): Promise<Title[]> {
  log('xcloud_api: Fetching recent titles');
  const result: RequestResponse<TitlesResponse> = await get({
    url: '/v2/titles/mru',
    query: { mr: 25 },
    credentialType: 'xgpuweb',
  });
  if (result.err) {
    errorLog(
      'xcloud_api: getRecentTitles failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  log('xcloud_api: Got', result.body.results.length, 'recent titles');
  return result.body.results;
}
