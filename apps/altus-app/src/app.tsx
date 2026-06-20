import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import '@/theme/colors';

import { StyleSheet, useStyles } from '@/components/theme_style';
import HomeScreen from '@/home_screen';
import LoginScreen from '@/login_screen';
import { init, useIsReady, useIsLoggedIn } from '@/stores/user_store';

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

export default function App() {
  const isReady = useIsReady();
  const isLoggedIn = useIsLoggedIn();

  useEffect(() => {
    void init();
  }, []);

  const s = useStyles(styles);

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
