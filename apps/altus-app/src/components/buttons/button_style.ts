import { StyleSheet, useStyles } from '../theme_style';

export const baseStyles = StyleSheet.create({
  blueButton: {
    backgroundColor: 'var(--button-blue-bg)',
    borderColor: 'var(--button-blue-border)',
  },
  blueText: { color: 'var(--button-blue-text)' },
  dangerButton: {
    backgroundColor: 'var(--button-danger-bg)',
    borderColor: 'var(--button-danger-border)',
  },
  dangerText: { color: 'var(--button-danger-text)' },
  defaultButton: {
    backgroundColor: 'var(--button-default-bg)',
    borderColor: 'var(--button-default-border)',
  },
  defaultText: { color: 'var(--button-default-text)' },
  disabledButton: {
    backgroundColor: 'var(--button-disabled-bg)',
    borderColor: 'var(--button-disabled-border)',
  },
  disabledText: { color: 'var(--button-disabled-text)' },
  emptyButton: {
    backgroundColor: 'var(--button-empty-bg)',
    borderColor: 'var(--button-empty-border)',
  },
  emptyText: { color: 'var(--button-empty-text)' },
  ghostButton: {
    backgroundColor: 'var(--button-ghost-bg)',
    borderColor: 'var(--button-ghost-border)',
  },
  ghostInvertedButton: {
    backgroundColor: 'var(--button-ghost-inverted-bg)',
    borderColor: 'var(--button-ghost-inverted-border)',
  },
  ghostInvertedText: { color: 'var(--button-ghost-inverted-text)' },
  ghostText: { color: 'var(--button-ghost-text)' },
  highlight: {
    borderRadius: 10,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  inner: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  invertedButton: {
    backgroundColor: 'var(--button-inverted-bg)',
    borderColor: 'var(--button-inverted-border)',
  },
  invertedText: { color: 'var(--button-inverted-text)' },
  text: { color: 'var(--button-text-color)', fontSize: 17 },
  textButton: {
    alignItems: 'center',
    backgroundColor: 'var(--button-bg)',
    borderRadius: 10,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'center',
    overflow: 'visible',
  },
});

export type ButtonType =
  | 'ghost'
  | 'ghost-inverted'
  | 'empty'
  | 'inverted'
  | 'danger'
  | 'blue'
  | 'default';

export interface StyleProps {
  disabled?: boolean;
  type?: ButtonType;
}
export function useButtonStyles(props: StyleProps) {
  const styles = useStyles(baseStyles);
  const { disabled, type } = props;
  let button_extra = styles.defaultButton;
  let text_extra = styles.defaultText;
  if (disabled) {
    button_extra = styles.disabledButton;
    text_extra = styles.disabledText;
  } else if (type === 'ghost') {
    button_extra = styles.ghostButton;
    text_extra = styles.ghostText;
  } else if (type === 'ghost-inverted') {
    button_extra = styles.ghostInvertedButton;
    text_extra = styles.ghostInvertedText;
  } else if (type === 'empty') {
    button_extra = styles.emptyButton;
    text_extra = styles.emptyText;
  } else if (type === 'inverted') {
    button_extra = styles.invertedButton;
    text_extra = styles.invertedText;
  } else if (type === 'danger') {
    button_extra = styles.dangerButton;
    text_extra = styles.dangerText;
  } else if (type === 'blue') {
    button_extra = styles.blueButton;
    text_extra = styles.blueText;
  }
  return { button_extra, text_extra };
}
