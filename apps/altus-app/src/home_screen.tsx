import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useStyles } from '@/components/theme_style';
import { fetch as fetchConsoles, useList } from '@/stores/console_store';
import { logout } from '@/stores/user_store';
import { useLatestCallback } from '@/tools/latest_callback';

const styles = StyleSheet.create({
  consoleDetail: {
    color: 'var(--secondary-text-color)',
    fontSize: 12,
    marginTop: 4,
  },
  consoleName: { color: 'var(--text-color)', fontSize: 16, fontWeight: '600' },
  consoleRow: {
    borderBottomColor: 'var(--form-box-border)',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  container: {
    backgroundColor: 'var(--bg-color)',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  empty: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    marginTop: 32,
    textAlign: 'center',
  },
  logout: { marginTop: 32 },
  title: {
    color: 'var(--text-color)',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default function HomeScreen() {
  const s = useStyles(styles);
  const consoles = useList();

  useEffect(() => {
    void fetchConsoles();
  }, []);

  const handleLogout = useLatestCallback(async () => {
    await logout();
  });

  if (consoles === null) {
    return (
      <View style={s.container}>
        <Text selectable style={s.empty}>
          {'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text selectable style={s.title}>
        {'Your Consoles'}
      </Text>
      {consoles.length === 0 ? (
        <Text selectable style={s.empty}>
          {'No consoles found'}
        </Text>
      ) : (
        consoles.map((c) => (
          <View key={c.serverId} style={s.consoleRow}>
            <Text selectable style={s.consoleName}>
              {c.deviceName}
            </Text>
            <Text selectable style={s.consoleDetail}>
              {`${c.consoleType} • ${c.powerState}`}
            </Text>
          </View>
        ))
      )}
      <TextButton
        text='Log Out'
        type='danger'
        onPress={handleLogout}
        style={s.logout}
      />
    </View>
  );
}
