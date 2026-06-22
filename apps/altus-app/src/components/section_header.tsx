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

const styles = StyleSheet.create({
  clearButton: { marginLeft: 4 },
  clearText: { color: 'var(--secondary-text-color)', fontSize: 14 },
  searchInput: {
    borderColor: 'var(--border-color)',
    borderRadius: 6,
    borderWidth: 1,
    color: 'var(--text-color)',
    fontSize: 14,
    height: 28,
    paddingHorizontal: 8,
    width: 180,
  },
  searchRow: { alignItems: 'center', flexDirection: 'row' },
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: 'var(--bg-color)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    paddingBottom: 12,
    paddingTop: 24,
  },
});
