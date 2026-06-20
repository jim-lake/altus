import type { RequestResponse } from '@/tools/api';

import api from '@/tools/api';
import { log, errorLog } from '@/tools/log';

function formBlob(data: string): Blob {
  return new Blob([data]);
}

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  ext_expires_in?: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface XstsResponse {
  IssueInstant: string;
  NotAfter: string;
  Token: string;
  DisplayClaims: { xui: Array<{ uhs: string; gtg?: string }> };
}

export interface StreamingTokenResponse {
  offeringSettings: {
    regions: Array<{ name: string; baseUri: string; isDefault: boolean }>;
  };
  market: string;
  gsToken: string;
  tokenType: string;
  durationInSeconds: number;
}

interface MsalTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id?: string;
}

export interface StreamingTokens {
  xHomeToken: StreamingTokenResponse | null;
  xCloudToken: StreamingTokenResponse | null;
}

export interface AuthTokens {
  userToken: TokenResponse;
  expiresAt: string;
}

const CLIENT_ID = '1f907974-e22b-4810-a9de-d9647380c97e';
const MSAL_BASE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const LIVE_BASE = 'https://login.live.com';

export class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;

  hasValidTokens(): boolean {
    return this.refreshToken !== null && this.expiresAt > Date.now();
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.now() + expiresIn * 1000;
  }

  async startDeviceCodeAuth(): Promise<DeviceCodeResponse> {
    log('AuthService: Starting device code auth');
    const body = `client_id=${CLIENT_ID}&scope=xboxlive.signin%20openid%20profile%20offline_access`;
    const result: RequestResponse<DeviceCodeResponse> = await api.post({
      url: `${MSAL_BASE}/devicecode`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBlob(body),
    });
    if (result.err) {
      errorLog(
        'AuthService: Device code request failed',
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    log('AuthService: Got device code', result.body.user_code);
    return result.body;
  }

  async pollDeviceCode(deviceCode: string, intervalMs = 5000): Promise<void> {
    log(
      'AuthService: Polling for device code completion, interval:',
      intervalMs
    );
    const body = `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${CLIENT_ID}&device_code=${deviceCode}`;
    const deadline = Date.now() + 900_000;

    while (Date.now() < deadline) {
      const result: RequestResponse<TokenResponse> = await api.rawRequest({
        url: `${MSAL_BASE}/token`,
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formBlob(body),
      });
      if (!result.err && result.body) {
        this.setTokens(
          result.body.access_token,
          result.body.refresh_token,
          result.body.expires_in
        );
        log(
          'AuthService: Device code auth successful, expires_in:',
          result.body.expires_in
        );
        return;
      }
      log('AuthService: Poll pending, retrying in', intervalMs, 'ms');
      await delay(intervalMs);
    }
    errorLog('AuthService: Device code auth timed out');
    throw new Error('Device code auth timed out');
  }

  async refreshTokens(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    log('AuthService: Refreshing tokens');
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      scope: 'xboxlive.signin openid profile offline_access',
    }).toString();

    const result: RequestResponse<TokenResponse> = await api.post({
      url: `${MSAL_BASE}/token`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBlob(body),
    });
    if (result.err) {
      errorLog(
        'AuthService: Token refresh failed',
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    this.setTokens(
      result.body.access_token,
      result.body.refresh_token,
      result.body.expires_in
    );
  }

  private async getAccessToken(): Promise<string> {
    if (!this.accessToken || this.expiresAt - Date.now() < 60_000) {
      await this.refreshTokens();
    }
    if (!this.accessToken) {
      throw new Error('No access token after refresh');
    }
    return this.accessToken;
  }

  private async doXstsAuth(
    userToken: string,
    relyingParty: string
  ): Promise<XstsResponse> {
    const payload = {
      Properties: { SandboxId: 'RETAIL', UserTokens: [userToken] },
      RelyingParty: relyingParty,
      TokenType: 'JWT',
    };
    const result: RequestResponse<XstsResponse> = await api.post({
      url: 'https://xsts.auth.xboxlive.com/xsts/authorize',
      headers: {
        'x-xbl-contract-version': '1',
        'content-type': 'application/json',
      },
      body: payload,
    });
    if (result.err) {
      errorLog(
        'AuthService: XSTS authorize failed',
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    return result.body;
  }

  private async doUserAuth(): Promise<XstsResponse> {
    const accessToken = await this.getAccessToken();
    const payload = {
      Properties: {
        AuthMethod: 'RPS',
        RpsTicket: `d=${accessToken}`,
        SiteName: 'user.auth.xboxlive.com',
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    };
    const result: RequestResponse<XstsResponse> = await api.post({
      url: 'https://user.auth.xboxlive.com/user/authenticate',
      headers: {
        'x-xbl-contract-version': '1',
        'content-type': 'application/json',
      },
      body: payload,
    });
    if (result.err) {
      errorLog(
        'AuthService: User auth failed',
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    return result.body;
  }

  async getStreamingTokens(): Promise<StreamingTokens> {
    log('AuthService: Getting streaming tokens');
    const userAuth = await this.doUserAuth();
    log('AuthService: Got user auth token');
    const gssvToken = await this.doXstsAuth(
      userAuth.Token,
      'http://gssv.xboxlive.com/'
    );
    log('AuthService: Got GSSV token');

    const xHomeToken = await this.getStreamToken(gssvToken.Token, 'xhome');
    log('AuthService: Got xHome token');
    let xCloudToken: StreamingTokenResponse | null = null;
    try {
      xCloudToken = await this.getStreamToken(gssvToken.Token, 'xgpuweb');
    } catch {
      try {
        xCloudToken = await this.getStreamToken(gssvToken.Token, 'xgpuwebf2p');
      } catch {
        errorLog('AuthService: Failed to get xCloud streaming token');
      }
    }
    return { xHomeToken, xCloudToken };
  }

  private async getStreamToken(
    userToken: string,
    offering: string
  ): Promise<StreamingTokenResponse> {
    const result: RequestResponse<StreamingTokenResponse> = await api.post({
      url: `https://${offering}.gssv-play-prod.xboxlive.com/v2/login/user`,
      headers: {
        'content-type': 'application/json',
        'x-gssv-client': 'XboxComBrowser',
      },
      body: { token: userToken, offeringId: offering },
    });
    if (result.err) {
      errorLog(
        'AuthService: Stream token failed',
        offering,
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    return result.body;
  }

  async getMsalToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      scope:
        'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN',
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    }).toString();

    const result: RequestResponse<MsalTokenResponse> = await api.post({
      url: `${LIVE_BASE}/oauth20_token.srf`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBlob(body),
    });
    if (result.err) {
      errorLog(
        'AuthService: MSAL token failed',
        result.err.message,
        result.body,
        result.text
      );
      throw result.err;
    }
    return result.body.access_token;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
