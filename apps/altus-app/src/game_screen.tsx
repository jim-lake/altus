import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

import { StyleSheet, useStyles } from '@/components/theme_style';
import StreamStore, { useStreamState } from '@/stores/stream_store';

import type { IceCandidate } from '@/stores/stream_store';
import type { ViewStyle } from 'react-native';

const styles = StyleSheet.create({
  gameScreen: { backgroundColor: 'black', flex: 1 },
  status: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    padding: 20,
    textAlign: 'center',
  },
  video: { flex: 1 },
});

interface Props {
  style?: ViewStyle;
  title: string;
  titleId: string;
}

export default function GameScreen({ style, title, titleId }: Props) {
  const s = useStyles(styles);
  const state = useStreamState();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const connectWebRTC = useCallback(
    async (sdpAnswer: string, iceCandidates: IceCandidate[]) => {
      const pc = new RTCPeerConnection({});
      pcRef.current = pc;

      pc.ontrack = (event: { streams: Array<{ toURL: () => string }> }) => {
        const stream = event.streams[0];
        if (stream) {
          setStreamUrl(stream.toURL());
        }
      };

      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = (await pc.createOffer({})) as { type: string; sdp: string };
      await pc.setLocalDescription(offer);

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer })
      );

      for (const candidate of iceCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    },
    []
  );

  useEffect(() => {
    void StreamStore.startPlay(titleId);
    return () => {
      StreamStore.stop();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [titleId]);

  useEffect(() => {
    if (state.phase === 'connected' && state.sdpAnswer && state.iceCandidates) {
      void connectWebRTC(state.sdpAnswer, state.iceCandidates);
    }
  }, [state.phase, state.sdpAnswer, state.iceCandidates, connectWebRTC]);

  if (state.phase === 'failed') {
    return (
      <View style={[s.gameScreen, style]}>
        <Text style={s.status}>{`Failed: ${state.error ?? 'unknown'}`}</Text>
      </View>
    );
  }

  if (streamUrl) {
    return (
      <View style={[s.gameScreen, style]}>
        <RTCView
          streamURL={streamUrl}
          style={s.video as object}
          objectFit='cover'
        />
      </View>
    );
  }

  return (
    <View style={[s.gameScreen, style]}>
      <Text style={s.status}>{`${title} — ${state.phase}`}</Text>
    </View>
  );
}
