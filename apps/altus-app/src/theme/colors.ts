import { PlatformColor } from 'react-native';

import { setVariables, setSchemeVariables } from '../components/theme_style';

setVariables({
  'text-color': 'black',
  'secondary-text-color': '#8a898d',
  'text-size': 10,
  'light-underlay': 'rgba(0,0,0,0.1)',
  modal: '#f3f2f7',
  'form-box-bg': PlatformColor('secondarySystemGroupedBackground'),
  'form-box-border': '#c6c5c9',
  'button-danger-text': '#fe4538',
  'button-bg': PlatformColor('link'),
  'button-text-color': 'white',
  'bottom-alert-sep': '#b1b0b4',
  'edit-bg': '#f3f2f7',
});

setSchemeVariables('dark', {
  'text-color': 'white',
  'secondary-text-color': '#8e8d94',
  'light-underlay': 'rgba(255,255,255,0.1)',
  modal: '#1c1c1e',
  'form-box-bg': PlatformColor('secondarySystemGroupedBackground'),
  'form-box-border': '#44434a',
  'button-text-color': 'black',
  'bottom-alert-sep': '#606060',
  'edit-bg': 'black',
});
