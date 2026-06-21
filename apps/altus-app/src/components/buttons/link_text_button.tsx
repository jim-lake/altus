import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';

import { useStyles } from '@/components/theme_style';

import { baseStyles, useButtonStyles } from './button_style';

import type { StyleProps } from './button_style';
import type { TextStyle, ViewStyle } from 'react-native';

interface Props extends StyleProps {
  style?: ViewStyle;
  textStyle?: TextStyle;
  text: string;
  url: string;
  disabled?: boolean;
  underlayColor?: string;
  beforeText?: React.ReactNode;
  afterText?: React.ReactNode;
}
export default function LinkTextButton(props: Props) {
  const {
    style,
    textStyle,
    text,
    url,
    disabled,
    underlayColor,
    beforeText,
    afterText,
  }: Props = props;
  const styles = useStyles(baseStyles);
  const { button_extra, text_extra } = useButtonStyles(props);

  return (
    <View style={[styles.textButton, button_extra, style]}>
      <View style={styles.inner}>
        {beforeText}
        <Text style={[styles.text, text_extra, textStyle]}>{text}</Text>
        {afterText}
      </View>
      {disabled ? null : (
        <TouchableHighlight
          style={styles.highlight}
          underlayColor={underlayColor ?? 'rgba(0,0,0,0.2)'}
          onPress={() => void Linking.openURL(url)}
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableHighlight>
      )}
    </View>
  );
}
