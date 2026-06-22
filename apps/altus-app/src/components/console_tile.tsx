import React from 'react';
import { Pressable, Text } from 'react-native';

import { StyleSheet, useStyles } from '@/components/theme_style';

import type { Console } from '@/lib/xcloud_api';
import type { ViewStyle } from 'react-native';

const styles = StyleSheet.create({
  consoleTile: {
    aspectRatio: 1,
    backgroundColor: 'var(--form-box-bg)',
    borderColor: 'var(--form-box-border)',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  detail: { color: 'var(--secondary-text-color)', fontSize: 11, marginTop: 4 },
  name: { color: 'var(--text-color)', fontSize: 14, fontWeight: '600' },
});

interface Props {
  style?: ViewStyle;
  console: Console;
  onPress?: (console: Console) => void;
}
export default function ConsoleTile({ console: c, style, onPress }: Props) {
  const s = useStyles(styles);
  return (
    <Pressable style={[s.consoleTile, style]} onPress={() => onPress?.(c)}>
      <Text selectable numberOfLines={1} style={s.name}>
        {c.deviceName}
      </Text>
      <Text selectable style={s.detail}>
        {`${c.consoleType} • ${c.powerState}`}
      </Text>
    </Pressable>
  );
}
