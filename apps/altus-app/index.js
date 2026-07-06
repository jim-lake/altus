import { AppRegistry } from 'react-native';

import App from './src/app';
import SettingsWindow from './src/settings_window';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('SettingsWindow', () => SettingsWindow);
