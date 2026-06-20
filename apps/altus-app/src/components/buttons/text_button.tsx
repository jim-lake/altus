import React from 'react';

import { StyleSheet, View, Text, TouchableHighlight } from 'react-native';
import { useStyles } from '../theme_style';

import { baseStyles, useButtonStyles } from './button_style';

import type { ViewStyle, TextStyle } from 'react-native';
import type { StyleProps } from './button_style';

interface Props extends StyleProps {
  style?: ViewStyle;
  textStyle?: TextStyle;
  text: string;
  disabled?: boolean;
  onPress?: () => void | Promise<void>;
  underlayColor?: string;
  beforeText?: React.ReactNode;
  afterText?: React.ReactNode;
  isBusy?: boolean;
}
export default function TextButton(props: Props) {
  const {
    style,
    textStyle,
    text,
    disabled,
    onPress,
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
          onPress={() => void onPress?.()}
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableHighlight>
      )}
    </View>
  );
}
