import React, { useEffect, useRef } from 'react';
import { Alert, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useStyles } from '@/components/theme_style';
import {
  handleKeyDown,
  handleKeyUp,
  init as initGamepad,
} from '@/lib/gamepad_handler';
import StreamStore, {
  useError,
  usePhase,
  useStreamUrl,
} from '@/stores/stream_store';
import { useLatestCallback } from '@/tools/latest_callback';

import type { HandledKeyEvent, KeyEvent, ViewStyle } from 'react-native';

const HANDLED_KEYS: HandledKeyEvent[] = [
  { key: 'w' },
  { key: 'a' },
  { key: 's' },
  { key: 'd' },
  { key: 'o' },
  { key: 'k' },
  { key: 'l' },
  { key: ';' },
  { key: 'x' },
  { key: 'y' },
  { key: 'b' },
  { key: ' ' },
  { key: 'q' },
  { key: 'e' },
];

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
  const viewRef = useRef<View>(null);

  useEffect(() => {
    initGamepad();
    void StreamStore.startPlay(titleId);
    // Request focus so key events fire
    const timer = setTimeout(() => {
      (viewRef.current as unknown as { focus?: () => void })?.focus?.();
    }, 100);
    return () => {
      clearTimeout(timer);
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

  const onKeyDown = useLatestCallback((e: KeyEvent) => {
    handleKeyDown(e.nativeEvent.key, e.nativeEvent.shiftKey);
  });

  const onKeyUp = useLatestCallback((e: KeyEvent) => {
    handleKeyUp(e.nativeEvent.key, e.nativeEvent.shiftKey);
  });

  return (
    <View
      ref={viewRef}
      style={[s.gameScreen, style]}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      keyDownEvents={HANDLED_KEYS}
      keyUpEvents={HANDLED_KEYS}
      focusable
    >
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
