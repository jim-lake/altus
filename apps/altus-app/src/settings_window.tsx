import React, { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { StyleSheet, useStyles } from '@/components/theme_style';
import {
  MAX_RESOLUTION_OPTIONS,
  setMaxResolution,
  useMaxResolution,
} from '@/stores/settings_store';

import type { MaxResolution } from '@/stores/settings_store';
import type { ViewStyle } from 'react-native';

const styles = StyleSheet.create({
  content: { padding: 24 },
  groupBox: {
    backgroundColor: 'var(--config-group-bg)',
    borderColor: 'var(--config-group-border)',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  groupTitle: {
    color: 'var(--secondary-text-color)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  picker: { width: 140 },
  section: { marginBottom: 24 },
  settingLabel: { color: 'var(--text-color)', fontSize: 13, fontWeight: '500' },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: 'var(--config-separator)',
    borderBottomWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingsWindow: { backgroundColor: 'var(--config-bg)', flex: 1 },
  title: {
    color: 'var(--text-color)',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default function SettingsWindow({ style }: { style?: ViewStyle }) {
  const s = useStyles(styles);
  const maxResolution = useMaxResolution();

  const handleResolutionChange = useCallback((value: MaxResolution) => {
    void setMaxResolution(value);
  }, []);

  return (
    <ScrollView
      style={[s.settingsWindow, style]}
      contentContainerStyle={s.content}
    >
      <Text selectable style={s.title}>
        {'Settings'}
      </Text>

      <View style={s.section}>
        <Text style={s.groupTitle}>{'Streaming'}</Text>
        <View style={s.groupBox}>
          <View style={s.settingRow}>
            <Text style={s.settingLabel}>{'Max Resolution'}</Text>
            <Picker
              style={s.picker}
              selectedValue={maxResolution}
              onValueChange={(value) => {
                handleResolutionChange(value);
              }}
            >
              {MAX_RESOLUTION_OPTIONS.map((option) => (
                <Picker.Item key={option} label={option} value={option} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
