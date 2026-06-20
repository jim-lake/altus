import type { RequestResponse } from '@/tools/api';

import api from '@/tools/api';
import { log, errorLog } from '@/tools/log';

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
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

export interface StreamingTokens {
  xHomeToken: StreamingTokenResponse | null;
  xCloudToken: StreamingTokenResponse | null;
}

const CLIENT_ID = '1f907974-e22b-4810-a9de-d9647380c97e';
const MSAL_BASE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const LIVE_BASE = 'https://login.live.com';

function formBlob(data: string): Blob {
  return new Blob([data]);
}

export async function startDeviceCodeAuth(): Promise<DeviceCodeResponse> {
  log('auth: Starting device code auth');
  const body = `client_id=${CLIENT_ID}&scope=xboxlive.signin%20openid%20profile%20offline_access`;
  const result: RequestResponse<DeviceCodeResponse> = await api.post({
    url: `${MSAL_BASE}/devicecode`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBlob(body),
  });
  if (result.err) {
    errorLog(
      'auth: Device code request failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  log('auth: Got device code', result.body.user_code);
  return result.body;
}

export async function checkDeviceCode(
  deviceCode: string
): Promise<TokenResponse | null> {
  const body = `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${CLIENT_ID}&device_code=${deviceCode}`;
  const result: RequestResponse<TokenResponse> = await api.rawRequest({
    url: `${MSAL_BASE}/token`,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBlob(body),
  });
  if (!result.err && result.body) {
    log(
      'auth: Device code auth successful, expires_in:',
      result.body.expires_in
    );
    return result.body;
  }
  return null;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  log('auth: Refreshing tokens');
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'xboxlive.signin openid profile offline_access',
  }).toString();

  const result: RequestResponse<TokenResponse> = await api.post({
    url: `${MSAL_BASE}/token`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBlob(body),
  });
  if (result.err) {
    errorLog(
      'auth: Token refresh failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  return result.body;
}

export async function getStreamingTokens(
  accessToken: string
): Promise<StreamingTokens> {
  log('auth: Getting streaming tokens');
  const userAuth = await doUserAuth(accessToken);
  log('auth: Got user auth token');
  const gssvToken = await doXstsAuthorize(
    userAuth.Token,
    'http://gssv.xboxlive.com/'
  );
  log('auth: Got GSSV token');

  const xHomeToken = await getStreamToken(gssvToken.Token, 'xhome');
  log('auth: Got xHome token');
  let xCloudToken: StreamingTokenResponse | null = null;
  try {
    xCloudToken = await getStreamToken(gssvToken.Token, 'xgpuweb');
    log('auth: Got xCloud token');
  } catch {
    try {
      xCloudToken = await getStreamToken(gssvToken.Token, 'xgpuwebf2p');
      log('auth: Got xCloud f2p token');
    } catch {
      errorLog('auth: Failed to get xCloud streaming token');
    }
  }
  return { xHomeToken, xCloudToken };
}

export async function getMsalToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    scope:
      'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();

  const result: RequestResponse<{ access_token: string }> = await api.post({
    url: `${LIVE_BASE}/oauth20_token.srf`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBlob(body),
  });
  if (result.err) {
    errorLog(
      'auth: MSAL token failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  return result.body.access_token;
}

async function doUserAuth(accessToken: string): Promise<XstsResponse> {
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
      'auth: User auth failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  return result.body;
}

async function doXstsAuthorize(
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
      'auth: XSTS authorize failed',
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  return result.body;
}

async function getStreamToken(
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
      'auth: Stream token failed',
      offering,
      result.err.message,
      result.body,
      result.text
    );
    throw result.err;
  }
  return result.body;
}
