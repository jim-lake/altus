import assert from 'node:assert';
import { describe, it } from 'node:test';

const ICE_RESPONSE_BODY = {
  exchangeResponse:
    '[{"candidate":"a=candidate:1 1 UDP 100 13.104.100.214 1119 typ host ","messageType":"iceCandidate","sdpMLineIndex":0,"sdpMid":"0"},{"candidate":"a=candidate:2 1 UDP 1 2603:1030:A05:3D::AD4:6A61 9002 typ host ","messageType":"iceCandidate","sdpMLineIndex":0,"sdpMid":"0"},{"candidate":"a=end-of-candidates","messageType":"iceCandidate","sdpMLineIndex":0,"sdpMid":"0"}]',
  errorDetails: null,
};

const SDP_RESPONSE_BODY = {
  exchangeResponse: JSON.stringify({
    sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\n',
  }),
};

interface IceEntry {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
  messageType: string;
}

function parseIceCandidates(exchangeResponse: string): IceEntry[] {
  const parsed = JSON.parse(exchangeResponse) as IceEntry[];
  return parsed.filter((c) => c.candidate !== 'a=end-of-candidates');
}

function parseSdpAnswer(exchangeResponse: string): string | null {
  const parsed = JSON.parse(exchangeResponse) as { sdp?: string };
  return parsed.sdp ?? null;
}

void describe('ICE response parsing', () => {
  void it('parses exchangeResponse as array of candidates', () => {
    const candidates = parseIceCandidates(ICE_RESPONSE_BODY.exchangeResponse);

    assert.strictEqual(candidates.length, 2);
    assert.strictEqual(
      candidates[0]?.candidate,
      'a=candidate:1 1 UDP 100 13.104.100.214 1119 typ host '
    );
    assert.strictEqual(candidates[0]?.sdpMid, '0');
    assert.strictEqual(candidates[0]?.sdpMLineIndex, 0);
    assert.strictEqual(
      candidates[1]?.candidate,
      'a=candidate:2 1 UDP 1 2603:1030:A05:3D::AD4:6A61 9002 typ host '
    );
  });

  void it('filters out end-of-candidates', () => {
    const all = JSON.parse(ICE_RESPONSE_BODY.exchangeResponse) as IceEntry[];
    assert.strictEqual(all.length, 3);
    const filtered = parseIceCandidates(ICE_RESPONSE_BODY.exchangeResponse);
    assert.strictEqual(filtered.length, 2);
  });
});

void describe('SDP response parsing', () => {
  void it('parses exchangeResponse as object with sdp field', () => {
    const sdp = parseSdpAnswer(SDP_RESPONSE_BODY.exchangeResponse);

    assert.ok(sdp);
    assert.ok(sdp.startsWith('v=0'));
  });

  void it('returns null when no sdp field', () => {
    const sdp = parseSdpAnswer(JSON.stringify({ noSdp: true }));
    assert.strictEqual(sdp, null);
  });
});
