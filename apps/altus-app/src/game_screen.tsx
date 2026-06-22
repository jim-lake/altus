import React, { useEffect } from 'react';
import { Alert, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useStyles } from '@/components/theme_style';
import StreamStore, {
  useError,
  usePhase,
  useStreamUrl,
} from '@/stores/stream_store';
import { useLatestCallback } from '@/tools/latest_callback';

import type { ViewStyle } from 'react-native';

const styles = StyleSheet.create({
  gameScreen: { backgroundColor: 'black', flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  placeholder: { backgroundColor: '#112244', flex: 1 },
  status: { color: '#aaa', fontSize: 11 },
  video: { flex: 1 },
});

interface Props {
  style?: ViewStyle;
  title: string;
  titleId: string;
  onDisconnect: () => void;
}

export default function GameScreen({
  style,
  title,
  titleId,
  onDisconnect,
}: Props) {
  const s = useStyles(styles);
  const phase = usePhase();
  const streamUrl = useStreamUrl();
  const error = useError();

  useEffect(() => {
    void StreamStore.startPlay(titleId);
    return () => {
      void StreamStore.stop();
    };
  }, [titleId]);

  const handleDisconnect = useLatestCallback(() => {
    Alert.alert('Disconnect', 'End the streaming session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void StreamStore.stop();
          onDisconnect();
        },
      },
    ]);
  });

  return (
    <View style={[s.gameScreen, style]}>
      <View style={s.header}>
        <Text style={s.status}>
          {`${title} | ${phase}${streamUrl ? ' | stream' : ''}${error ? ` | ${error}` : ''}`}
        </Text>
        <TextButton text='Disconnect' type='ghost' onPress={handleDisconnect} />
      </View>
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
