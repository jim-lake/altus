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

// Shim react-native-webrtc for Node.js
const webrtcPath = require.resolve('react-native-webrtc');
const FAKE_SDP = `v=0\r
o=- 4611731400430051336 2 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1\r
a=extmap-allow-mixed\r
a=msid-semantic: WMS\r
m=audio 9 UDP/TLS/RTP/SAVPF 111 63 9 102 0 8 105 13 110 113 126\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:aB1c\r
a=ice-pwd:aB1cD2eF3gH4iJ5kL6mN7oP8qR9s\r
a=ice-options:trickle\r
a=fingerprint:sha-256 A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1\r
a=rtpmap:63 red/48000/2\r
a=fmtp:63 111/111\r
a=rtpmap:9 G722/8000\r
a=rtpmap:102 ILBC/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
a=ssrc:1001 cname:audio0\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 35 36 37 38 39 40 41 42 127 125 108\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:aB1c\r
a=ice-pwd:aB1cD2eF3gH4iJ5kL6mN7oP8qR9s\r
a=ice-options:trickle\r
a=fingerprint:sha-256 A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2:C3:D4:E5:F6:A1:B2\r
a=setup:actpass\r
a=mid:1\r
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:13 urn:3gpp:video-orientation\r
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=recvonly\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 H264/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:98 H264/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=fmtp:98 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e034\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:35 H264/90000\r
a=rtcp-fb:35 goog-remb\r
a=rtcp-fb:35 transport-cc\r
a=rtcp-fb:35 ccm fir\r
a=rtcp-fb:35 nack\r
a=rtcp-fb:35 nack pli\r
a=fmtp:35 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:36 rtx/90000\r
a=fmtp:36 apt=35\r
a=rtpmap:37 H264/90000\r
a=rtcp-fb:37 goog-remb\r
a=rtcp-fb:37 transport-cc\r
a=rtcp-fb:37 ccm fir\r
a=rtcp-fb:37 nack\r
a=rtcp-fb:37 nack pli\r
a=fmtp:37 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d0032\r
a=rtpmap:38 rtx/90000\r
a=fmtp:38 apt=37\r
a=rtpmap:39 H264/90000\r
a=rtcp-fb:39 goog-remb\r
a=rtcp-fb:39 transport-cc\r
a=rtcp-fb:39 ccm fir\r
a=rtcp-fb:39 nack\r
a=rtcp-fb:39 nack pli\r
a=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e034\r
a=rtpmap:40 rtx/90000\r
a=fmtp:40 apt=39\r
a=rtpmap:41 VP8/90000\r
a=rtcp-fb:41 goog-remb\r
a=rtcp-fb:41 transport-cc\r
a=rtcp-fb:41 ccm fir\r
a=rtcp-fb:41 nack\r
a=rtcp-fb:41 nack pli\r
a=rtpmap:42 rtx/90000\r
a=fmtp:42 apt=41\r
a=rtpmap:127 ulpfec/90000\r
a=rtpmap:125 flexfec-03/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=fmtp:125 repair-window=10000000\r
a=rtpmap:108 red/90000\r
`;

require.cache[webrtcPath] = {
  id: webrtcPath,
  filename: webrtcPath,
  loaded: true,
  exports: {
    __esModule: true,
    RTCPeerConnection: class MockRTCPeerConnection {
      onicecandidate: ((event: unknown) => void) | null = null;
      addTransceiver() {}
      createOffer() {
        return Promise.resolve({ type: 'offer', sdp: FAKE_SDP });
      }
      setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({
            candidate: {
              candidate:
                'candidate:1 1 UDP 2130706431 192.168.1.100 9 typ host',
              sdpMid: '0',
              sdpMLineIndex: 0,
              usernameFragment: 'aB1c',
            },
          });
        }, 10);
        return Promise.resolve();
      }
      close() {}
    },
    RTCSessionDescription: class MockRTCSessionDescription {
      type: string;
      sdp: string;
      constructor({ type, sdp }: { type: string; sdp: string }) {
        this.type = type;
        this.sdp = sdp;
      }
    },
    RTCIceCandidate: class MockRTCIceCandidate {
      candidate: string;
      constructor(init: { candidate: string }) {
        this.candidate = init.candidate;
      }
    },
  },
} as NodeModule;

interface UserStoreModule {
  init: () => Promise<void>;
  isLoggedIn: () => boolean;
}

interface StreamStoreModule {
  startPlay: (titleId: string) => Promise<void>;
  getStreamState: () => {
    phase: string;
    sessionId: string | null;
    sdpAnswer: string | null;
    iceCandidates: unknown[] | null;
    error: string | null;
  };
  stop: () => void;
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

after(() => {
  StreamStore?.stop();
});

// Fortnite titleId
const FORTNITE_TITLE_ID = 'FORTNITE';

void describe('stream_store: startPlay negotiation', () => {
  void it('starts a session, provisions, and completes SDP exchange', async () => {
    // ICE exchange requires a real WebRTC stack (native app only).
    // This test validates: session start → provisioning → SDP offer/answer.
    // We don't await completion since ICE will timeout without real networking.
    void StreamStore.startPlay(FORTNITE_TITLE_ID);

    // Poll until we get an SDP answer or timeout after 60s
    let sdpAnswer: string | null = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const state = StreamStore.getStreamState();
      if (state.sdpAnswer) {
        sdpAnswer = state.sdpAnswer;
        break;
      }
      if (state.phase === 'failed') {
        break;
      }
    }

    const finalState = StreamStore.getStreamState();
    console.log('=== Final state ===');
    console.log('phase:', finalState.phase);
    console.log('sessionId:', finalState.sessionId);
    console.log('sdpAnswer length:', sdpAnswer?.length);

    assert.ok(finalState.sessionId, 'sessionId should be set');
    assert.ok(sdpAnswer, 'sdpAnswer should be received from server');
    assert.ok(
      sdpAnswer.includes('a=ice-ufrag:'),
      'sdpAnswer should contain valid ICE credentials'
    );
    assert.ok(
      sdpAnswer.includes('H264/90000'),
      'sdpAnswer should contain H264 video codec'
    );
  });
});
