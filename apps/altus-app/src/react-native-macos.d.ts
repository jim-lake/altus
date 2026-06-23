import 'react-native';

declare module 'react-native' {
  interface NativeKeyEvent {
    key: string;
    capsLockKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    numericPadKey: boolean;
    helpKey: boolean;
    functionKey: boolean;
  }
  interface KeyEvent {
    nativeEvent: NativeKeyEvent;
  }
  interface HandledKeyEvent {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }
  interface ViewProps {
    onKeyDown?: (event: KeyEvent) => void;
    onKeyUp?: (event: KeyEvent) => void;
    keyDownEvents?: HandledKeyEvent[];
    keyUpEvents?: HandledKeyEvent[];
  }
}
