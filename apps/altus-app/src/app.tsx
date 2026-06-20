import React, { useState } from 'react';
import { Text, View } from 'react-native';
import './theme/colors';

import type { DeviceCodeResponse, StreamingTokens } from '@/lib/auth';
import type { Console } from '@/lib/xcloud_api';

import LinkTextButton from '@/components/buttons/link_text_button';
import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useStyles } from '@/components/theme_style';
import { AuthService } from '@/lib/auth';
import { XCloudApiClient } from '@/lib/xcloud_api';
import { useLatestCallback } from '@/tools/latest_callback';
import { log } from '@/tools/log';

const auth = new AuthService();

type Screen = 'auth' | 'home';

const styles = StyleSheet.create({
  code: {
    color: 'var(--text-color)',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 16,
    textAlign: 'center',
  },
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
  info: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    marginBottom: 16,
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

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [consoles, setConsoles] = useState<Console[]>([]);

  const handleAuth = useLatestCallback(() => {
    setScreen('home');
  });

  const handleLogout = useLatestCallback(() => {
    auth.clearTokens();
    setConsoles([]);
    setScreen('auth');
  });

  if (screen === 'auth') {
    return <AuthScreen onDone={handleAuth} setConsoles={setConsoles} />;
  }
  return <HomeScreen consoles={consoles} onLogout={handleLogout} />;
}

interface AuthScreenProps {
  onDone: () => void;
  setConsoles: (c: Console[]) => void;
}
function AuthScreen({ onDone, setConsoles }: AuthScreenProps) {
  const s = useStyles(styles);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAuth = useLatestCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const dc = await auth.startDeviceCodeAuth();
      setDeviceCode(dc);
      await auth.pollDeviceCode(dc.device_code, dc.interval * 1000);
      const tokens: StreamingTokens = await auth.getStreamingTokens();
      if (tokens.xHomeToken) {
        const region =
          tokens.xHomeToken.offeringSettings.regions.find((r) => r.isDefault) ??
          tokens.xHomeToken.offeringSettings.regions[0];
        if (region) {
          const client = new XCloudApiClient(
            region.baseUri,
            tokens.xHomeToken.gsToken
          );
          const result = await client.getConsoles();
          setConsoles(result);
        }
      }
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      log('Auth error:', msg);
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
          />
          <Text style={s.info}>{'Waiting for authentication...'}</Text>
        </>
      ) : (
        <TextButton
          text={busy ? 'Starting...' : 'Sign In'}
          onPress={startAuth}
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

interface HomeScreenProps {
  consoles: Console[];
  onLogout: () => void;
}
function HomeScreen({ consoles, onLogout }: HomeScreenProps) {
  const s = useStyles(styles);

  return (
    <View style={s.container}>
      <Text style={s.title}>{'Your Consoles'}</Text>
      {consoles.length === 0 ? (
        <Text style={s.empty}>{'No consoles found'}</Text>
      ) : (
        consoles.map((c) => (
          <View key={c.serverId} style={s.consoleRow}>
            <Text style={s.consoleName}>{c.deviceName}</Text>
            <Text style={s.consoleDetail}>
              {`${c.consoleType} • ${c.powerState}`}
            </Text>
          </View>
        ))
      )}
      <TextButton
        text='Log Out'
        type='danger'
        onPress={onLogout}
        style={s.logout}
      />
    </View>
  );
}
