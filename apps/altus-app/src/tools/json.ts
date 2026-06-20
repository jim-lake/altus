export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONArray = JSONValue[];

export function jsonParse<T = JSONObject>(json_obj: string): T | undefined {
  try {
    return JSON.parse(json_obj) as T;
  } catch {
    return undefined;
  }
}
