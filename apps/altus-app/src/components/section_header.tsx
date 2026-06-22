import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import TextButton from '@/components/buttons/text_button';
import { StyleSheet, useColor, useStyles } from '@/components/theme_style';

import type { ViewStyle } from 'react-native';

interface Props {
  text: string;
  buttonText?: string;
  onButtonPress?: () => void | Promise<void>;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  style?: ViewStyle;
}

const styles = StyleSheet.create({
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
      {buttonText !== undefined && (
        <TextButton text={buttonText} type='danger' onPress={onButtonPress} />
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
