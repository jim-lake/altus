import React, { useState } from 'react';
import { Text, View } from 'react-native';

import LinkTextButton from '@/components/buttons/link_text_button';
import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useStyles } from '@/components/theme_style';
import { startLogin } from '@/stores/user_store';
import { useLatestCallback } from '@/tools/latest_callback';
import { log } from '@/tools/log';

import type { DeviceCodeResponse } from '@/lib/auth';

const styles = StyleSheet.create({
  code: {
    color: 'var(--text-color)',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 16,
    textAlign: 'center',
  },
  container: {
    backgroundColor: 'var(--bg-color)',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  info: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  openBrowser: { marginBottom: 16 },
});

export default function LoginScreen() {
  const s = useStyles(styles);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useLatestCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startLogin();
      setDeviceCode(result.deviceCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      log('LoginScreen: error', msg);
    } finally {
      setBusy(false);
    }
  });

  return (
    <View style={s.container}>
      {deviceCode ? (
        <>
          <Text selectable style={s.info}>
            {`Go to ${deviceCode.verification_uri} and enter:`}
          </Text>
          <Text selectable style={s.code}>
            {deviceCode.user_code}
          </Text>
          <LinkTextButton
            text='Open In Browser'
            url={`${deviceCode.verification_uri}?otc=${deviceCode.user_code}`}
            style={s.openBrowser}
          />
          <Text selectable style={s.info}>
            {'Waiting for authentication...'}
          </Text>
        </>
      ) : (
        <TextButton
          text={busy ? 'Starting...' : 'Sign In'}
          onPress={handleLogin}
          disabled={busy}
        />
      )}
      {error ? (
        <Text selectable style={s.info}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
