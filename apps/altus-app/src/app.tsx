import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import '@/theme/colors';

import { StyleSheet, useStyles } from '@/components/theme_style';
import HomeScreen from '@/home_screen';
import LoginScreen from '@/login_screen';
import ConsoleStore from '@/stores/console_store';
import UserStore, { useIsReady, useIsLoggedIn } from '@/stores/user_store';
import { herdOnce } from '@/tools/herd';

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'var(--bg-color)',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  loading: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    textAlign: 'center',
  },
});

const _startup = herdOnce(async () => {
  await UserStore.init();
  ConsoleStore.init();
});

export default function App() {
  const s = useStyles(styles);
  const isReady = useIsReady();
  const isLoggedIn = useIsLoggedIn();

  useEffect(() => {
    void _startup();
  }, []);

  if (!isReady) {
    return (
      <View style={s.container}>
        <Text style={s.loading}>{'Loading...'}</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return <HomeScreen />;
}
