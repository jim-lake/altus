import {
  addListener,
  sendControlMessage,
  sendInputFrame,
} from '@/stores/stream_store';
import { traceLog } from '@/tools/log';

// Button bitmask values from xbox-xcloud-player
const BUTTON_A = 16;
const BUTTON_B = 32;
const BUTTON_X = 64;
const BUTTON_Y = 128;
const BUTTON_LSHOULDER = 4096;
const BUTTON_RSHOULDER = 8192;

const AXIS_MAX = 32767;
const TRIGGER_MAX = 65535;

// Keyboard to gamepad mapping
const KEY_MAP: Record<string, string> = {
  w: 'leftStickUp',
  a: 'leftStickLeft',
  s: 'leftStickDown',
  d: 'leftStickRight',
  o: 'rightStickUp',
  k: 'rightStickLeft',
  l: 'rightStickDown',
  ';': 'rightStickRight',
  x: 'buttonX',
  y: 'buttonY',
  b: 'buttonB',
  ' ': 'buttonA',
  q: 'leftBumper',
  e: 'rightBumper',
};

const g_pressed = new Set<string>();
let g_sequence = 0;
let g_initialized = false;

export function init(): void {
  if (g_initialized) {
    return;
  }
  g_initialized = true;
  addListener('control_ready', _onControlReady);
}

function _onControlReady(): void {
  sendControlMessage({
    message: 'gamepadChanged',
    gamepadIndex: 0,
    wasAdded: true,
  });
  traceLog('gamepad_handler: sent gamepad added');
  _sendClientMetadata();
}

function _sendClientMetadata(): void {
  // ClientMetadata packet: reportType(2) + sequence(4) + timestamp(8) + maxTouchpoints(1) = 15 bytes
  const REPORT_CLIENT_METADATA = 8;
  const buf = new ArrayBuffer(15);
  const view = new DataView(buf);
  view.setUint16(0, REPORT_CLIENT_METADATA, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);
  view.setUint8(14, 0); // maxTouchpoints
  sendInputFrame(new Uint8Array(buf));
  traceLog('gamepad_handler: sent client metadata');
}

export function handleKeyDown(key: string, shiftKey: boolean): void {
  traceLog('gamepad_handler: keyDown', key, 'shift:', shiftKey);
  // Shift acts as left trigger
  if (shiftKey && !g_pressed.has('leftTrigger')) {
    g_pressed.add('leftTrigger');
    traceLog('gamepad_handler: mapped leftTrigger');
  } else if (!shiftKey && g_pressed.has('leftTrigger')) {
    g_pressed.delete('leftTrigger');
    traceLog('gamepad_handler: unmapped leftTrigger');
  }
  const action = KEY_MAP[key];
  if (!action) {
    _sendFrame();
    return;
  }
  if (g_pressed.has(action)) {
    return;
  }
  traceLog('gamepad_handler: mapped', action);
  g_pressed.add(action);
  _sendFrame();
}

export function handleKeyUp(key: string, shiftKey: boolean): void {
  traceLog('gamepad_handler: keyUp', key, 'shift:', shiftKey);
  // Update trigger state on any keyUp
  if (!shiftKey && g_pressed.has('leftTrigger')) {
    g_pressed.delete('leftTrigger');
    traceLog('gamepad_handler: unmapped leftTrigger');
  }
  const action = KEY_MAP[key];
  if (!action) {
    _sendFrame();
    return;
  }
  traceLog('gamepad_handler: unmapped', action);
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

  // Binary frame: reportType(2) + sequence(4) + timestamp(8) + frameCount(1) + gamepad(23) = 38 bytes
  const REPORT_GAMEPAD = 2;
  const buf = new ArrayBuffer(38);
  const view = new DataView(buf);

  // Header
  view.setUint16(0, REPORT_GAMEPAD, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);

  // Frame count
  view.setUint8(14, 1);

  // Gamepad frame (23 bytes at offset 15)
  view.setUint8(15, 0); // GamepadIndex
  view.setUint16(16, buttonMask, true);
  view.setInt16(18, leftX, true);
  view.setInt16(20, -leftY, true); // Y inverted
  view.setInt16(22, rightX, true);
  view.setInt16(24, -rightY, true); // Y inverted
  view.setUint16(26, leftTrigger, true);
  view.setUint16(28, rightTrigger, true);
  view.setUint32(30, 1, true); // PhysicalPhysicality (LE)
  view.setUint32(34, 1, false); // VirtualPhysicality (BE)

  traceLog(
    'gamepad_handler: sendFrame seq:',
    g_sequence,
    'buttons:',
    buttonMask
  );
  sendInputFrame(new Uint8Array(buf));
}

export default { init, handleKeyDown, handleKeyUp };
