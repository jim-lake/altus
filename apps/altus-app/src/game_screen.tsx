import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { StyleSheet, useStyles } from '@/components/theme_style';
import StreamStore, {
  useError,
  usePhase,
  useStreamUrl,
} from '@/stores/stream_store';

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
  const phase = usePhase();
  const streamUrl = useStreamUrl();
  const error = useError();

  useEffect(() => {
    void StreamStore.startPlay(titleId);
    return () => {
      StreamStore.stop();
    };
  }, [titleId]);

  if (phase === 'failed') {
    return (
      <View style={[s.gameScreen, style]}>
        <Text style={s.status}>{`Failed: ${error ?? 'unknown'}`}</Text>
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
      <Text style={s.status}>{`${title} — ${phase}`}</Text>
    </View>
  );
}
