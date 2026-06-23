import { EventEmitter } from 'events';

import { useSyncExternalStore } from 'react';
import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

import { del, get, getToken, post } from '@/stores/user_store';
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
  reliableinput: { minVersion: 9, maxVersion: 9 },
  unreliableinput: { minVersion: 9, maxVersion: 9 },
};

let g_phase: StreamPhase = 'idle';
let g_sessionId: string | null = null;
let g_streamUrl: string | null = null;
let g_error: string | null = null;
let g_keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let g_pc: RTCPeerConnection | null = null;

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

export function usePhase(): StreamPhase {
  return useSyncExternalStore(_subscribe, () => g_phase);
}
export function useStreamUrl(): string | null {
  return useSyncExternalStore(_subscribe, () => g_streamUrl);
}
export function useError(): string | null {
  return useSyncExternalStore(_subscribe, () => g_error);
}
export function getPhase(): StreamPhase {
  return g_phase;
}
export function getSessionId(): string | null {
  return g_sessionId;
}
export function getStreamUrl(): string | null {
  return g_streamUrl;
}
export function getError(): string | null {
  return g_error;
}

export async function startPlay(titleId: string): Promise<void> {
  _reset();
  g_stopped = false;
  g_phase = 'starting';
  _emit();

  try {
    g_sessionId = await _startSession(titleId, 'xgpuweb');
    g_phase = 'provisioning';
    _emit();

    await _pollUntilProvisioned(g_sessionId, 'xgpuweb');
    g_phase = 'provisioned';
    _emit();

    const { sdp, candidates } = await _createPeerConnection();
    g_phase = 'sdp_offer';
    _emit();

    await _sendSdpOffer(g_sessionId, sdp, 'xgpuweb');
    const sdpAnswer = await _pollSdpAnswer(g_sessionId, 'xgpuweb');

    // Send local candidates and poll for remote ones
    await _setRemoteDescription(sdpAnswer);
    await _sendIceCandidates(g_sessionId, 'xgpuweb', candidates);
    g_phase = 'sdp_answer';
    _emit();

    await _pollRemoteIceCandidates(g_sessionId, 'xgpuweb');
    g_phase = 'ice_exchange';
    _emit();

    _startKeepalive(g_sessionId, 'xgpuweb');
    g_phase = 'connected';
    _emit();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorLog('stream_store: startPlay failed', msg);
    g_phase = 'failed';
    g_error = msg;
    _emit();
  }
}

let g_stopped = false;

export async function stop(): Promise<void> {
  g_stopped = true;
  const sessionId = g_sessionId;
  const pc = g_pc;

  if (g_keepaliveTimer) {
    clearInterval(g_keepaliveTimer);
    g_keepaliveTimer = null;
  }
  g_pc = null;
  g_phase = 'idle';
  g_sessionId = null;
  g_streamUrl = null;
  g_error = null;
  _emit();

  if (pc) {
    pc.close();
  }
  if (sessionId) {
    log('stream_store: Stopping session', sessionId);
    await del({
      url: `/v5/sessions/cloud/${sessionId}`,
      credentialType: 'xgpuweb',
    });
    log('stream_store: Session stopped', sessionId);
  }
}

function _reset() {
  if (g_keepaliveTimer) {
    clearInterval(g_keepaliveTimer);
    g_keepaliveTimer = null;
  }
  if (g_pc) {
    g_pc.close();
    g_pc = null;
  }
  g_phase = 'idle';
  g_sessionId = null;
  g_streamUrl = null;
  g_error = null;
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
    if (g_stopped) {
      return;
    }
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

async function _createPeerConnection(): Promise<{
  sdp: string;
  candidates: string[];
}> {
  const pc = new RTCPeerConnection({});
  g_pc = pc;

  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });

  pc.onconnectionstatechange = () => {
    log('stream_store: connectionState:', pc.connectionState);
    if (pc.connectionState === 'failed') {
      errorLog('stream_store: peer connection failed');
    }
  };
  pc.oniceconnectionstatechange = () => {
    log('stream_store: iceConnectionState:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      errorLog('stream_store: ICE connection failed');
    }
    if (pc.iceConnectionState === 'disconnected') {
      errorLog('stream_store: ICE connection disconnected');
    }
  };
  pc.onicegatheringstatechange = () => {
    log('stream_store: iceGatheringState:', pc.iceGatheringState);
  };
  pc.onsignalingstatechange = () => {
    log('stream_store: signalingState:', pc.signalingState);
  };
  pc.onnegotiationneeded = () => {
    log('stream_store: negotiationneeded');
  };
  pc.onicecandidateerror = (event: {
    errorCode: number;
    errorText: string;
    url: string;
  }) => {
    errorLog(
      'stream_store: ICE candidate error:',
      event.errorCode,
      event.errorText,
      event.url
    );
  };
  pc.onerror = (event: { error: { message: string } }) => {
    errorLog('stream_store: peer connection error:', event.error?.message);
  };
  pc.ondatachannel = (event: { channel: { label: string } }) => {
    log('stream_store: ondatachannel:', event.channel.label);
  };

  const candidates: string[] = [];
  const gatheringDone = new Promise<void>((resolve) => {
    pc.onicecandidate = (event: {
      candidate: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment: string | null;
      } | null;
    }) => {
      if (event.candidate) {
        log('stream_store: local candidate:', event.candidate.candidate);
        candidates.push(
          JSON.stringify({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          })
        );
      } else {
        // null candidate means gathering complete
        resolve();
      }
    };
    // Fallback timeout in case null candidate never fires
    setTimeout(resolve, 5000);
  });

  pc.ontrack = (event: {
    track: { kind: string };
    streams: Array<{ toURL: () => string; id: string }>;
  }) => {
    log(
      'stream_store: ontrack kind:',
      event.track.kind,
      'streams:',
      event.streams.length
    );
    if (event.track.kind === 'video' && event.streams[0]) {
      g_streamUrl = event.streams[0].toURL();
      log('stream_store: streamUrl set:', g_streamUrl);
      _emit();
    }
  };

  // Create data channels BEFORE createOffer so they appear in the SDP
  _setupDataChannels(pc);

  const offer = (await pc.createOffer({})) as { type: string; sdp: string };
  // Enable stereo audio
  offer.sdp = offer.sdp.replace('useinbandfec=1', 'useinbandfec=1;stereo=1');
  await pc.setLocalDescription(offer);
  await gatheringDone;

  log('stream_store: Gathered', candidates.length, 'ICE candidates');
  return { sdp: offer.sdp, candidates };
}

async function _setRemoteDescription(sdp: string): Promise<void> {
  if (!g_pc) {
    throw new Error('no_peer_connection');
  }
  await g_pc.setRemoteDescription(
    new RTCSessionDescription({ type: 'answer', sdp })
  );
}

async function _sendSdpOffer(
  sessionId: string,
  sdp: string,
  credentialType: CredentialType
): Promise<void> {
  log('stream_store: SDP offer:\n', sdp);
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
    if (g_stopped) {
      throw new Error('stopped');
    }
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
      log('stream_store: Got SDP answer:\n', parsed.sdp);
      return parsed.sdp;
    }
  }
  errorLog('stream_store: sdp_answer_timeout after', MAX_POLLS, 'attempts');
  throw new Error('sdp_answer_timeout');
}

async function _sendIceCandidates(
  sessionId: string,
  credentialType: CredentialType,
  localCandidates: string[]
): Promise<void> {
  log('stream_store: Sending', localCandidates.length, 'ICE candidates');
  const result = await post<unknown>({
    url: `/v5/sessions/cloud/${sessionId}/ice`,
    credentialType,
    body: { candidates: localCandidates },
  });
  if (result.err) {
    errorLog('stream_store: ice POST failed', result.statusCode, result.text);
  }
}

async function _pollRemoteIceCandidates(
  sessionId: string,
  credentialType: CredentialType
): Promise<void> {
  if (!g_pc) {
    throw new Error('no_peer_connection');
  }
  const MAX_POLLS = 30;
  for (let i = 0; i < MAX_POLLS; i++) {
    if (g_stopped) {
      return;
    }
    await _sleep(1000);
    const result = await get<{ exchangeResponse: string }>({
      url: `/v5/sessions/cloud/${sessionId}/ice`,
      credentialType,
    });
    log('stream_store: ICE GET poll', i, 'status:', result.statusCode);
    if (result.statusCode === 204) {
      continue;
    }
    if (result.err) {
      errorLog('stream_store: ice GET failed', result.statusCode, result.text);
      continue;
    }
    log('stream_store: ICE GET body:', JSON.stringify(result.body));
    const parsed = JSON.parse(result.body.exchangeResponse) as Array<{
      candidate: string;
      sdpMid: string;
      sdpMLineIndex: number;
      messageType: string;
    }>;
    const candidates = parsed.filter(
      (c) => c.candidate !== 'a=end-of-candidates'
    );
    if (candidates.length > 0) {
      log('stream_store: Got', candidates.length, 'remote ICE candidates');
      for (const c of candidates) {
        log('stream_store: Adding remote candidate:', c.candidate);
        try {
          await g_pc.addIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex,
          });
        } catch (e) {
          errorLog(
            'stream_store: addIceCandidate failed:',
            e instanceof Error ? e.message : e,
            c.candidate
          );
        }
      }
      return;
    }
  }
  errorLog('stream_store: remote ICE poll timeout');
}

const ACCESS_KEY = '4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E';

function _setupDataChannels(pc: RTCPeerConnection): void {
  log('stream_store: Creating data channels');
  pc.createDataChannel('unreliableinput', {
    protocol: '2.0',
    ordered: false,
    maxRetransmits: 0,
  });
  pc.createDataChannel('reliableinput', { protocol: '2.0', ordered: true });
  const messageChannel = pc.createDataChannel('message', {
    protocol: 'messageV1',
    ordered: true,
  });
  const controlChannel = pc.createDataChannel('control', {
    protocol: 'controlV1',
    ordered: true,
  });
  const inputChannel = pc.createDataChannel('input', {
    protocol: '1.0',
    ordered: true,
  });
  const chatChannel = pc.createDataChannel('chat', {
    protocol: 'chatV1',
    ordered: true,
  });

  messageChannel.onopen = () => {
    log('stream_store: message channel open, sending handshake');
    const handshake = JSON.stringify({
      type: 'Handshake',
      version: 'messageV1',
      id: 'be0bfc6d-1e83-4c8a-90ed-fa8601c5a179',
      cv: '0',
    });
    messageChannel.send(new TextEncoder().encode(handshake));
  };
  messageChannel.onclose = () => {
    errorLog('stream_store: message channel closed');
  };
  messageChannel.onmessage = (event: { data: ArrayBuffer | string }) => {
    const text =
      typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);
    const msg = JSON.parse(text) as { type: string };
    log('stream_store: message channel recv:', msg.type);

    if (msg.type === 'HandshakeAck') {
      log('stream_store: message handshake complete, sending auth + config');
      _sendControlAuth(controlChannel);
      _sendMessageConfig(messageChannel);
    }
  };
  messageChannel.onerror = (event: unknown) => {
    errorLog('stream_store: message channel error:', event);
  };

  controlChannel.onopen = () => {
    log('stream_store: control channel open');
  };
  controlChannel.onclose = () => {
    errorLog('stream_store: control channel closed');
  };
  controlChannel.onmessage = (event: { data: ArrayBuffer | string }) => {
    const text =
      typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);
    log('stream_store: control channel recv:', text);
  };
  controlChannel.onerror = (event: unknown) => {
    errorLog('stream_store: control channel error:', event);
  };

  inputChannel.onopen = () => {
    log('stream_store: input channel open');
  };
  inputChannel.onclose = () => {
    errorLog('stream_store: input channel closed');
  };
  inputChannel.onerror = (event: unknown) => {
    errorLog('stream_store: input channel error:', event);
  };

  chatChannel.onopen = () => {
    log('stream_store: chat channel open');
  };
  chatChannel.onclose = () => {
    errorLog('stream_store: chat channel closed');
  };
  chatChannel.onerror = (event: unknown) => {
    errorLog('stream_store: chat channel error:', event);
  };
}

function _sendControlAuth(channel: { send: (data: Uint8Array) => void }) {
  const auth = JSON.stringify({
    message: 'authorizationRequest',
    accessKey: ACCESS_KEY,
  });
  channel.send(new TextEncoder().encode(auth));
  log('stream_store: sent control auth');

  const gamepad = JSON.stringify({
    message: 'gamepadChanged',
    gamepadIndex: 0,
    wasAdded: true,
  });
  channel.send(new TextEncoder().encode(gamepad));
  log('stream_store: sent gamepad added');
}

function _sendMessageConfig(channel: { send: (data: Uint8Array) => void }) {
  function sendMsg(target: string, content: object) {
    const msg = JSON.stringify({
      type: 'Message',
      content: JSON.stringify(content),
      id: _uuid(),
      target,
      cv: '',
    });
    channel.send(new TextEncoder().encode(msg));
  }

  sendMsg('/streaming/systemUi/configuration', {
    version: [0, 2, 0],
    systemUis: [],
  });
  sendMsg('/streaming/properties/clientappinstallidchanged', {
    clientAppInstallId: 'c97d7ee0-73b2-4239-bf1d-9d805a338429',
  });
  sendMsg('/streaming/characteristics/orientationchanged', { orientation: 0 });
  sendMsg('/streaming/characteristics/touchinputenabledchanged', {
    touchInputEnabled: false,
  });
  sendMsg('/streaming/characteristics/clientdevicecapabilities', {});
  sendMsg('/streaming/characteristics/dimensionschanged', {
    horizontal: 1920,
    vertical: 1080,
    preferredWidth: 1920,
    preferredHeight: 1080,
    safeAreaLeft: 0,
    safeAreaTop: 0,
    safeAreaRight: 1920,
    safeAreaBottom: 1080,
    supportsCustomResolution: true,
  });
  log('stream_store: sent message config');
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

function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default {
  usePhase,
  useStreamUrl,
  useError,
  getPhase,
  getSessionId,
  getStreamUrl,
  getError,
  startPlay,
  stop,
};
