import AsyncStorage from '@react-native-async-storage/async-storage';

export default { getItem, setItem };

export interface StorageResult<T = unknown> {
  err: null | Error;
  value: T | undefined;
}
export async function getItem<T = unknown>(
  key: string
): Promise<StorageResult<T>> {
  let err: null | Error = null;
  let value: T | undefined;
  try {
    const val = await AsyncStorage.getItem(key);
    if (val !== null) {
      value = JSON.parse(val) as T;
    }
  } catch (e) {
    err = e as Error;
  }
  return { err, value };
}
export interface SetParams<T = unknown> {
  key: string;
  value?: T;
}
export async function setItem<T = unknown>(
  params: SetParams<T>
): Promise<void> {
  return AsyncStorage.setItem(params.key, JSON.stringify(params.value));
}
