import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, SectionList, Text, View } from 'react-native';

import TextButton from '@/components/buttons/text_button';
import ConsoleTile from '@/components/console_tile';
import GameTile from '@/components/game_tile';
import SectionHeader from '@/components/section_header';
import { StyleSheet, useStyles } from '@/components/theme_style';
import {
  fetch as fetchConsoles,
  useList as useConsoleList,
} from '@/stores/console_store';
import {
  fetch as fetchGames,
  useLatestList,
  useList as useGameList,
} from '@/stores/game_store';
import { useSearchResult } from '@/stores/product_store';
import { logout } from '@/stores/user_store';
import { useLatestCallback } from '@/tools/latest_callback';

import type { Console, Title } from '@/lib/xcloud_api';
import type { ViewStyle } from 'react-native';

const TARGET_TILE_WIDTH = 200;
const ROW_HORIZONTAL_PADDING = 20;
const TILE_MARGIN = 5;

const styles = StyleSheet.create({
  content: { padding: 0 },
  empty: {
    color: 'var(--secondary-text-color)',
    fontSize: 14,
    marginBottom: 10,
    marginLeft: ROW_HORIZONTAL_PADDING + TILE_MARGIN,
    paddingVertical: 8,
  },
  homeScreen: { backgroundColor: 'var(--bg-color)', flex: 1 },
  row: {
    flexDirection: 'row',
    marginBottom: TILE_MARGIN * 2,
    paddingHorizontal: ROW_HORIZONTAL_PADDING,
  },
  sectionHeaderRow: {
    paddingBottom: 10,
    paddingLeft: ROW_HORIZONTAL_PADDING + TILE_MARGIN,
    paddingRight: ROW_HORIZONTAL_PADDING + TILE_MARGIN,
    paddingTop: 10,
  },
  showMoreButton: {
    marginBottom: 10,
    marginLeft: ROW_HORIZONTAL_PADDING + TILE_MARGIN,
  },
  spacer: { flex: 1, marginHorizontal: TILE_MARGIN },
  tile: { flex: 1, marginHorizontal: TILE_MARGIN },
});

type RowItem =
  | { key: string; type: 'consoles'; items: Console[] }
  | { key: string; type: 'games'; items: Title[] }
  | { key: string; type: 'empty'; message: string }
  | { key: string; type: 'showMore' };

interface Section {
  title: string;
  data: RowItem[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

export default function HomeScreen({ style }: { style?: ViewStyle }) {
  const s = useStyles(styles);
  const [contentWidth, setContentWidth] = useState(
    Dimensions.get('window').width
  );
  const consoles = useConsoleList();
  const latestGames = useLatestList();
  const games = useGameList();
  const [moreLatestGames, setMoreLatestGames] = useState(false);
  const [gameSearch, setGameSearch] = useState('');

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      setContentWidth(e.nativeEvent.layout.width);
    },
    []
  );

  const cols = Math.max(1, Math.floor(contentWidth / TARGET_TILE_WIDTH));

  useEffect(() => {
    void fetchConsoles();
    void fetchGames();
  }, []);

  const handleLogout = useLatestCallback(async () => {
    await logout();
  });

  const filteredGames = useSearchResult(games, gameSearch);

  const sections: Section[] = useMemo(() => {
    const consoleSectionData: RowItem[] =
      consoles === null
        ? [{ key: 'c-empty', type: 'empty', message: 'Loading...' }]
        : consoles.length === 0
          ? [{ key: 'c-none', type: 'empty', message: 'No consoles found' }]
          : chunkArray(consoles, cols).map((items, i) => ({
              key: `c-${i}`,
              type: 'consoles',
              items,
            }));

    const visibleLatest = latestGames
      ? moreLatestGames
        ? latestGames
        : latestGames.slice(0, cols)
      : null;
    const latestSectionData: RowItem[] =
      visibleLatest === null
        ? [{ key: 'l-empty', type: 'empty', message: 'Loading...' }]
        : visibleLatest.length === 0
          ? [{ key: 'l-none', type: 'empty', message: 'No recent games' }]
          : [
              ...chunkArray(visibleLatest, cols).map(
                (items, i): RowItem => ({ key: `l-${i}`, type: 'games', items })
              ),
              ...(!moreLatestGames && latestGames && latestGames.length > cols
                ? [{ key: 'l-more', type: 'showMore' } as RowItem]
                : []),
            ];

    const gameSectionData: RowItem[] =
      filteredGames === null
        ? [{ key: 'g-empty', type: 'empty', message: 'Loading...' }]
        : filteredGames.length === 0
          ? [
              {
                key: 'g-none',
                type: 'empty',
                message: 'No cloud games available',
              },
            ]
          : chunkArray(filteredGames, cols).map((items, i) => ({
              key: `g-${i}`,
              type: 'games',
              items,
            }));

    return [
      { title: 'Your Consoles', data: consoleSectionData },
      { title: 'Continue Playing', data: latestSectionData },
      { title: 'Cloud Games', data: gameSectionData },
    ];
  }, [consoles, cols, latestGames, filteredGames, moreLatestGames]);

  return (
    <SectionList
      style={[s.homeScreen, style]}
      contentContainerStyle={s.content}
      onLayout={onLayout}
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(item) => item.key}
      renderSectionHeader={({ section }) => (
        <SectionHeader
          style={s.sectionHeaderRow}
          text={section.title}
          buttonText={section.title === 'Your Consoles' ? 'Log Out' : undefined}
          onButtonPress={
            section.title === 'Your Consoles' ? handleLogout : undefined
          }
          onSearchChange={
            section.title === 'Cloud Games' ? setGameSearch : undefined
          }
          searchValue={section.title === 'Cloud Games' ? gameSearch : undefined}
        />
      )}
      renderItem={({ item }) => {
        if (item.type === 'empty') {
          return (
            <Text selectable style={s.empty}>
              {item.message}
            </Text>
          );
        }
        if (item.type === 'showMore') {
          return (
            <TextButton
              style={s.showMoreButton}
              text='Show More'
              type='ghost'
              onPress={() => {
                setMoreLatestGames(true);
              }}
            />
          );
        }
        if (item.type === 'consoles') {
          const spacers = cols - item.items.length;
          return (
            <View style={s.row}>
              {item.items.map((c) => (
                <ConsoleTile key={c.serverId} style={s.tile} console={c} />
              ))}
              {Array.from({ length: spacers }, (_, i) => (
                <View key={`sp-${i}`} style={s.spacer} />
              ))}
            </View>
          );
        }
        const spacers = cols - item.items.length;
        return (
          <View style={s.row}>
            {item.items.map((t) => (
              <GameTile key={t.titleId} style={s.tile} title={t} />
            ))}
            {Array.from({ length: spacers }, (_, i) => (
              <View key={`sp-${i}`} style={s.spacer} />
            ))}
          </View>
        );
      }}
      ListFooterComponent={null}
    />
  );
}
