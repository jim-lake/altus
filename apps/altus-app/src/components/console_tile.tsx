import React from 'react';
import { Text, View } from 'react-native';

import { StyleSheet, useStyles } from '@/components/theme_style';

import type { Console } from '@/lib/xcloud_api';

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    backgroundColor: 'var(--form-box-bg)',
    borderColor: 'var(--form-box-border)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
    overflow: 'hidden',
    padding: 12,
  },
  detail: { color: 'var(--secondary-text-color)', fontSize: 11, marginTop: 4 },
  name: { color: 'var(--text-color)', fontSize: 14, fontWeight: '600' },
});

interface Props {
  console: Console;
}

export default function ConsoleTile({ console: c }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.container}>
      <Text selectable numberOfLines={1} style={s.name}>
        {c.deviceName}
      </Text>
      <Text selectable style={s.detail}>
        {`${c.consoleType} • ${c.powerState}`}
      </Text>
    </View>
  );
}
