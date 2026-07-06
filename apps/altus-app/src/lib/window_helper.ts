import NSWindowModule from 'react-native-nswindow';

import { log } from '@/tools/log';

const SETTINGS_WINDOW_NAME = 'settings';

export async function openSettings(): Promise<void> {
  const existing = await NSWindowModule.listWindows();
  for (const windowId of existing) {
    const state = await NSWindowModule.getWindowState(windowId);
    if (state.windowName === SETTINGS_WINDOW_NAME) {
      log('window_helper: Settings window already open, focusing');
      await NSWindowModule.focusWindow(windowId);
      return;
    }
  }

  log('window_helper: Opening settings window');
  await NSWindowModule.addWindow({
    componentName: 'SettingsWindow',
    windowName: SETTINGS_WINDOW_NAME,
    initialProps: {},
    title: 'Settings',
    width: 500,
    height: 450,
    minWidth: 400,
    minHeight: 350,
    center: true,
    vibrancy: 'sidebar',
    autoSaveFrame: 'altus-settings-window',
  });
}

export default { openSettings };
