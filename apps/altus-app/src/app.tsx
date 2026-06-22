import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { StyleSheet, useStyles } from '@/components/theme_style';
import GameScreen from '@/game_screen';
import HomeScreen from '@/home_screen';
import LoginScreen from '@/login_screen';
import ConsoleStore from '@/stores/console_store';
import GameStore from '@/stores/game_store';
import ProductStore from '@/stores/product_store';
import UserStore, { useIsLoggedIn, useIsReady } from '@/stores/user_store';
import { herdOnce } from '@/tools/herd';

import type { Title } from '@/lib/xcloud_api';

import '@/theme/colors';

const styles = StyleSheet.create({
  app: {
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
  GameStore.init();
  await ProductStore.init();
});

interface ActiveGame {
  title: string;
  titleId: string;
}

export default function App() {
  const s = useStyles(styles);
  const isReady = useIsReady();
  const isLoggedIn = useIsLoggedIn();
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);

  useEffect(() => {
    void _startup();
  }, []);

  const handleGamePress = useCallback((title: Title) => {
    setActiveGame({ title: title.details.productId, titleId: title.titleId });
  }, []);

  if (!isReady) {
    return (
      <View style={s.app}>
        <Text style={s.loading}>{'Loading...'}</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  if (activeGame) {
    return (
      <GameScreen
        title={activeGame.title}
        titleId={activeGame.titleId}
        onDisconnect={() => {
          setActiveGame(null);
        }}
      />
    );
  }

  return <HomeScreen onGamePress={handleGamePress} />;
}
