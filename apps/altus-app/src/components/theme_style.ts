import { useColorScheme, StyleSheet as BaseStyleSheet } from 'react-native';

import type {
  ColorValue,
  ImageStyle,
  OpaqueColorValue,
  TextStyle,
  ViewStyle,
} from 'react-native';

type VarRef = `var(--${string})`;
type StyleValue<P> = P extends number
  ? number | VarRef
  : P extends string
    ? string | VarRef
    : P;

type BaseStyleMap<T = object> = {
  [K in keyof T]: {
    [P in keyof (ImageStyle & TextStyle & ViewStyle)]?: StyleValue<
      (ImageStyle & TextStyle & ViewStyle)[P]
    >;
  };
};
type OutputStyleMap<T = object> = {
  [K in keyof T]: {
    [P in keyof (ImageStyle & TextStyle & ViewStyle)]?: (ImageStyle &
      TextStyle &
      ViewStyle)[P];
  };
};

interface SchemeStyles<T = object> {
  base: BaseStyleMap<T>;
  light?: OutputStyleMap<T>;
  dark?: OutputStyleMap<T>;
}
declare const _opaque: unique symbol;
type Opaque<T, Name> = T & { readonly [_opaque]: Name };
export type ThemedStyles<T> = Opaque<SchemeStyles, T>;

type ColorScheme = 'dark' | 'light';
type VariableValue = number | string | OpaqueColorValue;
type StyleVariableMap = Record<string, VariableValue>;

const g_transformList: SchemeStyles[] = [];
const g_variableMap = new Map<string, VariableValue>();
const g_schemeVariableMap = new Map<ColorScheme, Map<string, VariableValue>>();

function create<T extends BaseStyleMap<T>>(base: T): ThemedStyles<T> {
  const obj = { base };
  g_transformList.push(obj);
  return obj as unknown as ThemedStyles<T>;
}
function _initThemes() {
  if (g_transformList.length > 0) {
    for (const obj of g_transformList) {
      obj.light = _makeStyleSheet('light' as const, obj.base);
      obj.dark = _makeStyleSheet('dark' as const, obj.base);
    }
    g_transformList.splice(0);
  }
}
export function useStyles<T>(obj: ThemedStyles<T>): OutputStyleMap<T> {
  _initThemes();
  const scheme = useColorScheme() ?? 'light';
  return obj[scheme] as OutputStyleMap<T>;
}
export function useColor(name: string): ColorValue {
  const var_name = `var(--${name})`;
  const scheme = useColorScheme() ?? 'light';
  const scheme_map = g_schemeVariableMap.get(scheme);
  return (scheme_map?.get(var_name) ??
    g_variableMap.get(var_name) ??
    'transparent') as ColorValue;
}
export function setSchemeVariables(
  scheme: ColorScheme,
  variable_map: StyleVariableMap
) {
  let map = g_schemeVariableMap.get(scheme);
  if (!map) {
    map = new Map<string, number | string>();
    g_schemeVariableMap.set(scheme, map);
  }
  for (const k in variable_map) {
    map.set(`var(--${k})`, variable_map[k]);
  }
}
export function setVariables(variable_map: StyleVariableMap) {
  for (const k in variable_map) {
    g_variableMap.set(`var(--${k})`, variable_map[k]);
  }
}
function _makeStyleSheet<T extends BaseStyleMap>(
  scheme: ColorScheme,
  input: BaseStyleMap<T>
) {
  const style_map = { ...input } as Record<
    string,
    Record<string, number | string | OpaqueColorValue>
  >;
  const scheme_map =
    g_schemeVariableMap.get(scheme) ?? new Map<string, number | string>();
  for (const name in style_map) {
    const style = { ...style_map[name] };
    style_map[name] = style;
    for (const k in style) {
      const value = style[k];
      if (scheme_map.has(value as string)) {
        style[k] = scheme_map.get(value as string) ?? '';
      } else if (g_variableMap.has(value as string)) {
        style[k] = g_variableMap.get(value as string) ?? '';
      }
    }
  }
  return BaseStyleSheet.create(style_map as OutputStyleMap<T>);
}
export const StyleSheet = {
  create,
  absoluteFill: BaseStyleSheet.absoluteFill,
  absoluteFillObject: BaseStyleSheet.absoluteFillObject,
  hairlineWidth: BaseStyleSheet.hairlineWidth,
};
