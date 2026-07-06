import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useColor, useStyles } from '@/components/theme_style';

import type { ViewStyle } from 'react-native';

interface Props {
  text: string;
  buttonText?: string;
  onButtonPress?: () => void | Promise<void>;
  onSettingsPress?: () => void;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  style?: ViewStyle;
}

const styles = StyleSheet.create({
  buttonRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  clearButton: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 0,
    width: 20,
  },
  clearText: { color: 'var(--secondary-text-color)', fontSize: 14 },
  searchInput: {
    color: 'var(--text-color)',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: 'var(--search-bg)',
    borderColor: 'var(--search-border)',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 20,
    maxWidth: 500,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingsButton: {
    alignItems: 'center',
    borderColor: 'var(--button-ghost-border)',
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  settingsIcon: { color: 'var(--button-ghost-text)', fontSize: 16 },
  title: {
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default function SectionHeader({
  text,
  buttonText,
  onButtonPress,
  onSettingsPress,
  onSearchChange,
  searchValue,
  style,
}: Props) {
  const s = useStyles(styles);
  const placeholderColor = useColor('secondary-text-color');

  return (
    <View style={[s.sectionHeader, style]}>
      <Text selectable style={s.title}>
        {text}
      </Text>
      {(buttonText !== undefined || onSettingsPress !== undefined) && (
        <View style={s.buttonRow}>
          {onSettingsPress !== undefined && (
            <TouchableOpacity
              style={s.settingsButton}
              onPress={onSettingsPress}
              activeOpacity={0.6}
            >
              <Text style={s.settingsIcon}>{'⚙'}</Text>
            </TouchableOpacity>
          )}
          {buttonText !== undefined && (
            <TextButton
              text={buttonText}
              type='danger'
              onPress={onButtonPress}
            />
          )}
        </View>
      )}
      {onSearchChange !== undefined && (
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            autoFocus
            placeholder='Search...'
            placeholderTextColor={placeholderColor}
            value={searchValue}
            onChangeText={onSearchChange}
          />
          {(searchValue?.length ?? 0) > 0 && (
            <TouchableOpacity
              style={s.clearButton}
              onPress={() => {
                onSearchChange('');
              }}
            >
              <Text style={s.clearText}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
