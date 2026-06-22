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
  placeholder: { backgroundColor: '#112244', flex: 1 },
  status: { color: '#aaa', fontSize: 11, padding: 8 },
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

  return (
    <View style={[s.gameScreen, style]}>
      <Text style={s.status}>
        {`${title} | phase: ${phase} | stream: ${streamUrl ? 'yes' : 'no'}${error ? ` | error: ${error}` : ''}`}
      </Text>
      {streamUrl ? (
        <RTCView
          streamURL={streamUrl}
          style={s.video as object}
          objectFit='cover'
        />
      ) : (
        <View style={s.placeholder} />
      )}
    </View>
  );
}
