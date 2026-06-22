import { describe, it } from 'node:test';
import {
  RTCPeerConnection,
  RTCRtpCodecParameters,
  RTCSessionDescription,
} from 'werift';

const CODECS = {
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
};

void describe('werift cleanup', () => {
  void it('exits cleanly after two PCs connect and close', async () => {
    const pc1 = new RTCPeerConnection({ codecs: CODECS });
    const pc2 = new RTCPeerConnection({ codecs: CODECS });

    pc1.addTransceiver('audio', { direction: 'recvonly' });
    pc1.addTransceiver('video', { direction: 'recvonly' });
    pc1.createDataChannel('test');

    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(
      new RTCSessionDescription(offer.sdp, 'offer')
    );

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(
      new RTCSessionDescription(answer.sdp, 'answer')
    );

    // Wait for connected or timeout
    await new Promise<void>((resolve) => {
      pc1.connectionStateChange.subscribe((state) => {
        console.log('pc1 state:', state);
        if (state === 'connected') {
          resolve();
        }
      });
      setTimeout(resolve, 5000);
    });

    console.log('closing...');
    await pc1.close();
    await pc2.close();
    console.log('closed');
  });
});
