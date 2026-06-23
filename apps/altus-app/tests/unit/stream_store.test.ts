import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { before, after, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { URL } from 'node:url';

import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const EXPIRES_AT = process.env.EXPIRES_AT;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

assert.ok(ACCESS_TOKEN, 'ACCESS_TOKEN must be set in .env');
assert.ok(EXPIRES_AT, 'EXPIRES_AT must be set in .env');
assert.ok(REFRESH_TOKEN, 'REFRESH_TOKEN must be set in .env');

// Shim AsyncStorage
const g_storage = new Map<string, string>();
g_storage.set(
  'ALTUS_TOKEN_KEY',
  JSON.stringify({
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: Number(EXPIRES_AT),
  })
);

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
        headers: { ...headers, connection: 'close' },
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

// Use real WebRTC via werift (pure TypeScript, no native codecs needed)
import {
  RTCPeerConnection as WeriftPeerConnection,
  RTCSessionDescription as WeriftSessionDescription,
  RTCIceCandidate as WeriftIceCandidate,
  RTCRtpCodecParameters,
  MediaStream as WeriftMediaStream,
} from 'werift';

const webrtcPath = require.resolve('react-native-webrtc');

// Patch MediaStream prototype to add toURL() which react-native-webrtc provides
(WeriftMediaStream.prototype as unknown as { toURL: () => string }).toURL =
  function (this: { id: string }) {
    return this.id;
  };

// Wrap RTCPeerConnection to configure H264 codec (xCloud requires it)
let g_videoRtpCount = 0;
let g_audioRtpCount = 0;
const g_unsubs: Array<() => void> = [];

class PatchedPeerConnection extends WeriftPeerConnection {
  constructor(config?: object) {
    super({
      ...config,
      bundlePolicy: 'max-bundle',
      codecs: {
        audio: [
          new RTCRtpCodecParameters({
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            payloadType: 111,
          }),
        ],
        video: [
          new RTCRtpCodecParameters({
            mimeType: 'video/H264',
            clockRate: 90000,
            payloadType: 96,
            parameters:
              'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
          }),
        ],
      },
    });

    this.addEventListener(
      'track',
      (e: {
        track: {
          kind: string;
          onReceiveRtp: {
            subscribe: (cb: () => void) => { unSubscribe: () => void };
          };
        };
      }) => {
        if (e.track.kind === 'video') {
          const sub = e.track.onReceiveRtp.subscribe(() => {
            g_videoRtpCount++;
          });
          g_unsubs.push(() => sub.unSubscribe());
        } else if (e.track.kind === 'audio') {
          const sub = e.track.onReceiveRtp.subscribe(() => {
            g_audioRtpCount++;
          });
          g_unsubs.push(() => sub.unSubscribe());
        }
      }
    );
  }
}

function getVideoRtpCount() {
  return g_videoRtpCount;
}
function getAudioRtpCount() {
  return g_audioRtpCount;
}
function cleanupRtp() {
  for (const unsub of g_unsubs) {
    unsub();
  }
  g_unsubs.length = 0;
}

// Wrap RTCSessionDescription to accept { type, sdp } like react-native-webrtc
class CompatSessionDescription extends WeriftSessionDescription {
  constructor(init: { type: string; sdp: string } | string, type?: string) {
    if (typeof init === 'object') {
      super(init.sdp, init.type as 'offer' | 'answer');
    } else {
      super(init, (type ?? 'offer') as 'offer' | 'answer');
    }
  }
}

require.cache[webrtcPath] = {
  id: webrtcPath,
  filename: webrtcPath,
  loaded: true,
  exports: {
    __esModule: true,
    RTCPeerConnection: PatchedPeerConnection,
    RTCSessionDescription: CompatSessionDescription,
    RTCIceCandidate: WeriftIceCandidate,
    MediaStream: WeriftMediaStream,
  },
} as NodeModule;

interface UserStoreModule {
  init: () => Promise<void>;
  isLoggedIn: () => boolean;
}

interface StreamStoreModule {
  startPlay: (titleId: string) => Promise<void>;
  getPhase: () => string;
  getSessionId: () => string | null;
  getStreamUrl: () => string | null;
  getError: () => string | null;
  stop: () => Promise<void>;
}

let UserStore: UserStoreModule;
let StreamStore: StreamStoreModule;

before(async () => {
  const userMod = await import('../../src/stores/user_store.ts');
  UserStore = userMod.default;
  await UserStore.init();

  if (!UserStore.isLoggedIn()) {
    console.log(
      'SKIP: Not logged in (tokens may be expired). Refresh .env credentials to run live test.'
    );
    process.exit(0);
  }

  const streamMod = await import('../../src/stores/stream_store.ts');
  StreamStore = streamMod.default;
});

after(async () => {
  await StreamStore?.stop();
});

// Fortnite titleId
const FORTNITE_TITLE_ID = 'FORTNITE';

void describe('stream_store: startPlay negotiation', () => {
  void it('starts a session, provisions, SDP exchanges, ICE connects, and gets video track', async () => {
    const playPromise = StreamStore.startPlay(FORTNITE_TITLE_ID);

    // Poll until connected or fail (120s max)
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const phase = StreamStore.getPhase();
      if (phase === 'connected' || phase === 'failed') {
        break;
      }
    }

    const phase = StreamStore.getPhase();
    const sessionId = StreamStore.getSessionId();
    const streamUrl = StreamStore.getStreamUrl();
    const error = StreamStore.getError();

    console.log('=== Final state ===');
    console.log('phase:', phase);
    console.log('sessionId:', sessionId);
    console.log('streamUrl:', streamUrl);
    console.log('error:', error);

    assert.ok(sessionId, 'sessionId should be set');
    assert.strictEqual(
      phase,
      'connected',
      `expected connected, got: ${phase} (error: ${error})`
    );
    assert.ok(streamUrl, 'streamUrl should be set (video track received)');

    // Wait up to 10s for video RTP packets to arrive
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (getVideoRtpCount() > 0) {
        break;
      }
    }

    console.log('video RTP packets:', getVideoRtpCount());
    console.log('audio RTP packets:', getAudioRtpCount());

    assert.ok(getVideoRtpCount() > 0, 'should receive video RTP packets');
    assert.ok(getAudioRtpCount() > 0, 'should receive audio RTP packets');

    // Unsubscribe RTP listeners before closing so werift can exit cleanly
    cleanupRtp();
    await StreamStore.stop();
    await playPromise.catch(() => {});
  });
});
