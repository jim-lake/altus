import { PlatformColor } from 'react-native';

import { setSchemeVariables, setVariables } from '../components/theme_style';

setVariables({
  'bg-color': 'white',
  'text-color': '#1a1a1a',
  'secondary-text-color': '#555555',
  'text-size': 10,
  'light-underlay': 'rgba(0,0,0,0.1)',
  modal: '#f3f2f7',
  'form-box-bg': PlatformColor('secondarySystemGroupedBackground'),
  'form-box-border': '#c6c5c9',
  'button-danger-text': '#d32f2f',
  'button-bg': PlatformColor('link'),
  'button-text-color': 'white',
  'bottom-alert-sep': '#b1b0b4',
  'edit-bg': '#f3f2f7',
});

setSchemeVariables('light', {
  'bg-color': 'white',
  'text-color': '#1a1a1a',
  'secondary-text-color': '#555555',
});

setSchemeVariables('dark', {
  'bg-color': '#1c1c1e',
  'text-color': '#f0f0f0',
  'secondary-text-color': '#a1a0a6',
  'light-underlay': 'rgba(255,255,255,0.1)',
  modal: '#1c1c1e',
  'form-box-bg': PlatformColor('secondarySystemGroupedBackground'),
  'form-box-border': '#44434a',
  'button-text-color': 'white',
  'bottom-alert-sep': '#606060',
  'edit-bg': 'black',
});
