import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';

import { get, getToken, post } from '@/stores/user_store';
import { errorLog, log } from '@/tools/log';

import type { CredentialType } from '@/stores/user_store';

export type StreamPhase =
  | 'idle'
  | 'starting'
  | 'provisioning'
  | 'provisioned'
  | 'sdp_offer'
  | 'sdp_answer'
  | 'ice_exchange'
  | 'connected'
  | 'failed';

export interface IceCandidate {
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}

export interface StreamState {
  phase: StreamPhase;
  sessionId: string | null;
  sdpAnswer: string | null;
  iceCandidates: IceCandidate[] | null;
  error: string | null;
}

interface StartStreamResponse {
  sessionPath: string;
  sessionId?: string;
}

interface SessionStateResponse {
  state: string;
  errorDetails?: { code?: string; message?: string };
}

interface SdpResponse {
  sdp: string;
  exchangeResponse: string;
}

interface IceResponse {
  exchangeResponse: string;
}

const SDP_CONFIGURATION = {
  chatConfiguration: {
    bytesPerSample: 2,
    expectedClipDurationMs: 20,
    format: { codec: 'opus', container: 'webm' },
    numChannels: 1,
    sampleFrequencyHz: 24000,
  },
  chat: { minVersion: 1, maxVersion: 1 },
  control: { minVersion: 1, maxVersion: 3 },
  input: { minVersion: 1, maxVersion: 9 },
  message: { minVersion: 1, maxVersion: 1 },
};

let g_state: StreamState = {
  phase: 'idle',
  sessionId: null,
  sdpAnswer: null,
  iceCandidates: null,
  error: null,
};
let g_keepaliveTimer: ReturnType<typeof setInterval> | null = null;

const g_eventEmitter = new EventEmitter();
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
function _setState(partial: Partial<StreamState>) {
  g_state = { ...g_state, ...partial };
  _emit();
}

export function useStreamState(): StreamState {
  return useSyncExternalStore(_subscribe, () => g_state);
}

export function getStreamState(): StreamState {
  return g_state;
}

export async function startPlay(titleId: string): Promise<void> {
  _reset();
  _setState({ phase: 'starting' });

  try {
    const sessionId = await _startSession(titleId, 'xgpuweb');
    _setState({ sessionId, phase: 'provisioning' });

    await _pollUntilProvisioned(sessionId, 'xgpuweb');
    _setState({ phase: 'provisioned' });

    const { sdp: sdpOffer, candidates: localCandidates } = await _createOffer();
    _setState({ phase: 'sdp_offer' });

    await _sendSdpOffer(sessionId, sdpOffer, 'xgpuweb');
    const sdpAnswer = await _pollSdpAnswer(sessionId, 'xgpuweb');
    _setState({ phase: 'sdp_answer', sdpAnswer });

    const iceCandidates = await _exchangeIce(
      sessionId,
      'xgpuweb',
      localCandidates
    );
    _setState({ phase: 'ice_exchange', iceCandidates });

    _startKeepalive(sessionId, 'xgpuweb');
    _setState({ phase: 'connected' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorLog('stream_store: startPlay failed', msg);
    _setState({ phase: 'failed', error: msg });
  }
}

export function stop(): void {
  _reset();
}

function _reset() {
  if (g_keepaliveTimer) {
    clearInterval(g_keepaliveTimer);
    g_keepaliveTimer = null;
  }
  g_state = {
    phase: 'idle',
    sessionId: null,
    sdpAnswer: null,
    iceCandidates: null,
    error: null,
  };
  _emit();
}

async function _startSession(
  titleId: string,
  credentialType: CredentialType
): Promise<string> {
  const result = await post<StartStreamResponse>({
    url: '/v5/sessions/cloud/play',
    credentialType,
    body: {
      titleId,
      systemUpdateGroup: '',
      clientSessionId: '',
      settings: {
        nanoVersion: 'V3;WebrtcTransport.dll',
        enableTextToSpeech: false,
        highContrast: 0,
        locale: 'en-US',
        useIceConnection: false,
        timezoneOffsetMinutes: 0,
        sdkType: 'web',
        osName: 'windows',
      },
    },
  });
  if (result.err) {
    errorLog(
      'stream_store: start_session_failed',
      result.statusCode,
      result.text
    );
    throw new Error(`start_session_failed: ${result.statusCode}`);
  }
  const sessionId =
    result.body.sessionId ?? result.body.sessionPath.split('/').pop() ?? '';
  if (!sessionId) {
    errorLog('stream_store: No sessionId in response', result.body);
    throw new Error('start_session_failed: no sessionId');
  }
  log('stream_store: Session started', sessionId);
  return sessionId;
}

async function _pollUntilProvisioned(
  sessionId: string,
  credentialType: CredentialType
): Promise<void> {
  const MAX_POLLS = 60;
  let connected = false;
  for (let i = 0; i < MAX_POLLS; i++) {
    await _sleep(1000);
    const result = await get<SessionStateResponse>({
      url: `/v5/sessions/cloud/${sessionId}/state`,
      credentialType,
    });
    if (result.err) {
      errorLog(
        'stream_store: poll_state_failed',
        result.statusCode,
        result.text
      );
      throw new Error(`poll_state_failed: ${result.statusCode}`);
    }
    const state = result.body.state;
    log('stream_store: Session state:', state);

    if (state === 'ReadyToConnect' && !connected) {
      await _sendConnect(sessionId, credentialType);
      connected = true;
      continue;
    }
    if (state === 'Provisioned') {
      return;
    }
    if (state === 'Failed') {
      const msg = result.body.errorDetails?.message ?? 'unknown';
      errorLog('stream_store: Session failed', result.body.errorDetails);
      throw new Error(`session_failed: ${msg}`);
    }
  }
  errorLog('stream_store: poll_timeout after', MAX_POLLS, 'attempts');
  throw new Error('poll_timeout');
}

async function _sendConnect(
  sessionId: string,
  credentialType: CredentialType
): Promise<void> {
  const msalToken = await getToken('msal');
  const result = await post<unknown>({
    url: `/v5/sessions/cloud/${sessionId}/connect`,
    credentialType,
    body: { userToken: msalToken },
  });
  if (result.err) {
    errorLog('stream_store: connect failed', result.statusCode, result.text);
  }
  log('stream_store: Connect sent');
}

async function _createOffer(): Promise<{ sdp: string; candidates: string[] }> {
  const { RTCPeerConnection } = await import('react-native-webrtc');
  const pc = new RTCPeerConnection({});
  pc.addTransceiver('audio', { direction: 'sendrecv' });
  pc.addTransceiver('video', { direction: 'recvonly' });

  const candidates: string[] = [];
  pc.onicecandidate = (event: {
    candidate: {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
      usernameFragment: string | null;
    } | null;
  }) => {
    if (event.candidate) {
      candidates.push(
        JSON.stringify({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        })
      );
    }
  };

  const offer = (await pc.createOffer({})) as { type: string; sdp: string };
  await pc.setLocalDescription(offer);

  // Wait briefly for ICE gathering
  await _sleep(500);

  pc.close();
  return { sdp: offer.sdp, candidates };
}

async function _sendSdpOffer(
  sessionId: string,
  sdp: string,
  credentialType: CredentialType
): Promise<void> {
  const result = await post<unknown>({
    url: `/v5/sessions/cloud/${sessionId}/sdp`,
    credentialType,
    body: {
      messageType: 'offer',
      sdp,
      requestId: '1',
      configuration: SDP_CONFIGURATION,
    },
  });
  if (result.err) {
    errorLog('stream_store: sdp_offer_failed', result.statusCode, result.text);
    throw new Error(`sdp_offer_failed: ${result.statusCode}`);
  }
  log('stream_store: SDP offer sent');
}

async function _pollSdpAnswer(
  sessionId: string,
  credentialType: CredentialType
): Promise<string> {
  const MAX_POLLS = 20;
  for (let i = 0; i < MAX_POLLS; i++) {
    await _sleep(500);
    const result = await get<SdpResponse>({
      url: `/v5/sessions/cloud/${sessionId}/sdp`,
      credentialType,
    });
    if (result.statusCode === 204) {
      continue;
    }
    if (result.err) {
      errorLog(
        'stream_store: sdp_answer_failed',
        result.statusCode,
        result.text
      );
      throw new Error(`sdp_answer_failed: ${result.statusCode}`);
    }
    const parsed = JSON.parse(result.body.exchangeResponse) as { sdp?: string };
    if (parsed.sdp) {
      log('stream_store: Got SDP answer');
      return parsed.sdp;
    }
  }
  errorLog('stream_store: sdp_answer_timeout after', MAX_POLLS, 'attempts');
  throw new Error('sdp_answer_timeout');
}

async function _exchangeIce(
  sessionId: string,
  credentialType: CredentialType,
  localCandidates: string[]
): Promise<IceCandidate[]> {
  log('stream_store: Sending', localCandidates.length, 'ICE candidates');
  const postResult = await post<unknown>({
    url: `/v5/sessions/cloud/${sessionId}/ice`,
    credentialType,
    body: { candidates: localCandidates },
  });
  if (postResult.err) {
    errorLog(
      'stream_store: ice POST failed',
      postResult.statusCode,
      postResult.text
    );
  }

  const MAX_POLLS = 120;
  for (let i = 0; i < MAX_POLLS; i++) {
    await _sleep(1000);
    const result = await get<IceResponse>({
      url: `/v5/sessions/cloud/${sessionId}/ice`,
      credentialType,
    });
    if (result.statusCode === 204) {
      continue;
    }
    if (result.err) {
      errorLog(
        'stream_store: ice_exchange_failed',
        result.statusCode,
        result.text
      );
      throw new Error(`ice_exchange_failed: ${result.statusCode}`);
    }
    const parsed = JSON.parse(result.body.exchangeResponse) as {
      candidates?: IceCandidate[];
    };
    if (parsed.candidates && parsed.candidates.length > 0) {
      log('stream_store: Got', parsed.candidates.length, 'ICE candidates');
      return parsed.candidates.map((c) => ({
        candidate: c.candidate,
        sdpMLineIndex: c.sdpMLineIndex,
        sdpMid: c.sdpMid,
      }));
    }
  }
  errorLog('stream_store: ice_exchange_timeout after', MAX_POLLS, 'attempts');
  throw new Error('ice_exchange_timeout');
}

function _startKeepalive(
  sessionId: string,
  credentialType: CredentialType
): void {
  g_keepaliveTimer = setInterval(() => {
    void (async () => {
      const result = await post({
        url: `/v5/sessions/cloud/${sessionId}/keepalive`,
        credentialType,
      });
      if (result.err) {
        errorLog(
          'stream_store: keepalive failed',
          result.statusCode,
          result.text
        );
      }
    })();
  }, 30_000);
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { useStreamState, getStreamState, startPlay, stop };
