import NSEvent from 'react-native-nsevent';

import {
  addListener as addInputHandlerListener,
  announceGamepad,
  sendGamepadState,
} from '@/lib/webrtc_input_handler';
import { log, traceLog } from '@/tools/log';

// Button bitmask values
const BUTTON_A = 16;
const BUTTON_B = 32;
const BUTTON_X = 64;
const BUTTON_Y = 128;
const BUTTON_LSHOULDER = 4096;
const BUTTON_RSHOULDER = 8192;

const AXIS_MAX = 32767;
const TRIGGER_MAX = 65535;

// Default keyboard to gamepad mapping (by macOS keyCode)
const KEY_CODE_W = 13;
const KEY_CODE_A = 0;
const KEY_CODE_S = 1;
const KEY_CODE_D = 2;
const KEY_CODE_O = 31;
const KEY_CODE_K = 40;
const KEY_CODE_L = 37;
const KEY_CODE_SEMICOLON = 41;
const KEY_CODE_X = 7;
const KEY_CODE_Y = 16;
const KEY_CODE_B = 11;
const KEY_CODE_SPACE = 49;
const KEY_CODE_Q = 12;
const KEY_CODE_E = 14;

const DEFAULT_KEY_MAP: Record<number, string> = {
  [KEY_CODE_W]: 'leftStickUp',
  [KEY_CODE_A]: 'leftStickLeft',
  [KEY_CODE_S]: 'leftStickDown',
  [KEY_CODE_D]: 'leftStickRight',
  [KEY_CODE_O]: 'rightStickUp',
  [KEY_CODE_K]: 'rightStickLeft',
  [KEY_CODE_L]: 'rightStickDown',
  [KEY_CODE_SEMICOLON]: 'rightStickRight',
  [KEY_CODE_X]: 'buttonX',
  [KEY_CODE_Y]: 'buttonY',
  [KEY_CODE_B]: 'buttonB',
  [KEY_CODE_SPACE]: 'buttonA',
  [KEY_CODE_Q]: 'leftBumper',
  [KEY_CODE_E]: 'rightBumper',
};

const g_pressed = new Set<string>();
let g_initialized = false;
let g_listening = false;
let g_unsubReady: (() => void) | null = null;
let g_unsubStop: (() => void) | null = null;

export function init(): void {
  if (g_initialized) {
    return;
  }
  g_initialized = true;
  g_unsubReady = addInputHandlerListener('ready', _onReady);
  g_unsubStop = addInputHandlerListener('stop', _onStop);
}

export function stop(): void {
  _stopListening();
  if (g_unsubReady) {
    g_unsubReady();
    g_unsubReady = null;
  }
  if (g_unsubStop) {
    g_unsubStop();
    g_unsubStop = null;
  }
  g_initialized = false;
}

function _onReady(): void {
  log('input_processor: ready, starting input capture');
  announceGamepad(0, true);
  _startListening();
}

function _onStop(): void {
  log('input_processor: stop, stopping input capture');
  _stopListening();
  g_pressed.clear();
}

function _startListening(): void {
  if (g_listening) {
    return;
  }
  g_listening = true;
  NSEvent.registerKeyboardEventCallback(_onKeyboardEvent);
  NSEvent.startCapture();
}

function _stopListening(): void {
  if (!g_listening) {
    return;
  }
  g_listening = false;
  NSEvent.stopCapture();
  NSEvent.registerKeyboardEventCallback(null);
}

function _onKeyboardEvent(
  keyCode: number,
  pressed: boolean,
  shift: boolean,
  _control: boolean,
  _option: boolean,
  _command: boolean,
  _capsLock: boolean,
  _fn: boolean
): void {
  if (pressed) {
    _onKeyDown(keyCode, shift);
  } else {
    _onKeyUp(keyCode, shift);
  }
}

function _onKeyDown(keyCode: number, shift: boolean): void {
  traceLog('input_processor: keyDown code:', keyCode, 'shift:', shift);

  // Shift acts as left trigger
  if (shift && !g_pressed.has('leftTrigger')) {
    g_pressed.add('leftTrigger');
  } else if (!shift && g_pressed.has('leftTrigger')) {
    g_pressed.delete('leftTrigger');
  }

  const action = DEFAULT_KEY_MAP[keyCode];
  if (!action) {
    _sendFrame();
    return;
  }
  if (g_pressed.has(action)) {
    return;
  }
  traceLog('input_processor: mapped', action);
  g_pressed.add(action);
  _sendFrame();
}

function _onKeyUp(keyCode: number, shift: boolean): void {
  traceLog('input_processor: keyUp code:', keyCode, 'shift:', shift);

  // Update trigger state on any keyUp
  if (!shift && g_pressed.has('leftTrigger')) {
    g_pressed.delete('leftTrigger');
  }

  const action = DEFAULT_KEY_MAP[keyCode];
  if (!action) {
    _sendFrame();
    return;
  }
  traceLog('input_processor: unmapped', action);
  g_pressed.delete(action);
  _sendFrame();
}

function _sendFrame(): void {
  let buttonMask = 0;
  let leftX = 0;
  let leftY = 0;
  let rightX = 0;
  let rightY = 0;
  let leftTrigger = 0;
  let rightTrigger = 0;

  for (const action of g_pressed) {
    switch (action) {
      case 'leftStickUp':
        leftY = -AXIS_MAX;
        break;
      case 'leftStickDown':
        leftY = AXIS_MAX;
        break;
      case 'leftStickLeft':
        leftX = -AXIS_MAX;
        break;
      case 'leftStickRight':
        leftX = AXIS_MAX;
        break;
      case 'rightStickUp':
        rightY = -AXIS_MAX;
        break;
      case 'rightStickDown':
        rightY = AXIS_MAX;
        break;
      case 'rightStickLeft':
        rightX = -AXIS_MAX;
        break;
      case 'rightStickRight':
        rightX = AXIS_MAX;
        break;
      case 'buttonA':
        buttonMask |= BUTTON_A;
        break;
      case 'buttonB':
        buttonMask |= BUTTON_B;
        break;
      case 'buttonX':
        buttonMask |= BUTTON_X;
        break;
      case 'buttonY':
        buttonMask |= BUTTON_Y;
        break;
      case 'leftBumper':
        buttonMask |= BUTTON_LSHOULDER;
        break;
      case 'rightBumper':
        buttonMask |= BUTTON_RSHOULDER;
        break;
      case 'leftTrigger':
        leftTrigger = TRIGGER_MAX;
        break;
      case 'rightTrigger':
        rightTrigger = TRIGGER_MAX;
        break;
    }
  }

  sendGamepadState(
    0,
    buttonMask,
    leftX,
    leftY,
    rightX,
    rightY,
    leftTrigger,
    rightTrigger
  );
}

export default { init, stop };
