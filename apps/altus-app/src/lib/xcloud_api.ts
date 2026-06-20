import type { RequestResponse } from '@/tools/api';

import api from '@/tools/api';
import { log, errorLog } from '@/tools/log';

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
    supportedTabs: string[];
    supportedInputTypes: string[];
    programs: Array<{ programId: string }>;
    userPrograms: Array<{ programId: string }>;
    maxGamepass: boolean;
  };
}

interface TitlesResponse {
  totalItems: number;
  results: Title[];
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

export class XCloudApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(host: string, token: string) {
    this.baseUrl = host.startsWith('https://') ? host : `https://${host}`;
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
      'content-type': 'application/json',
      'x-gssv-client': 'XboxComBrowser',
      'x-ms-device-info': DEVICE_INFO,
    };
  }

  async getConsoles(): Promise<Console[]> {
    log('XCloudApi: Fetching consoles from', this.baseUrl);
    const result: RequestResponse<ConsolesResponse> = await api.get({
      url: `${this.baseUrl}/v6/servers/home`,
      headers: this.headers(),
    });
    if (result.err) {
      errorLog('XCloudApi: getConsoles failed', result.err.message);
      throw result.err;
    }
    log('XCloudApi: Got', result.body.results.length, 'consoles');
    return result.body.results;
  }

  async getTitles(): Promise<Title[]> {
    log('XCloudApi: Fetching titles');
    const result: RequestResponse<TitlesResponse> = await api.get({
      url: `${this.baseUrl}/v2/titles`,
      headers: this.headers(),
    });
    if (result.err) {
      errorLog('XCloudApi: getTitles failed', result.err.message);
      throw result.err;
    }
    log('XCloudApi: Got', result.body.results.length, 'titles');
    return result.body.results;
  }

  async getRecentTitles(): Promise<Title[]> {
    log('XCloudApi: Fetching recent titles');
    const result: RequestResponse<TitlesResponse> = await api.get({
      url: `${this.baseUrl}/v2/titles/mru`,
      headers: this.headers(),
      query: { mr: 25 },
    });
    if (result.err) {
      errorLog('XCloudApi: getRecentTitles failed', result.err.message);
      throw result.err;
    }
    log('XCloudApi: Got', result.body.results.length, 'recent titles');
    return result.body.results;
  }
}
