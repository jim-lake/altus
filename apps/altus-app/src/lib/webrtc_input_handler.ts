import { EventEmitter } from 'events';

import {
  addListener as addStreamListener,
  sendControlMessage,
  sendInputFrame,
} from '@/stores/stream_store';
import { log, traceLog } from '@/tools/log';

const AXIS_MAX = 32767;
const TRIGGER_MAX = 65535;

const REPORT_GAMEPAD = 2;
const REPORT_KEYBOARD = 3;
const REPORT_MOUSE = 4;
const REPORT_CLIENT_METADATA = 8;

const g_eventEmitter = new EventEmitter();

let g_sequence = 0;
let g_initialized = false;
let g_active = false;
let g_unsubReady: (() => void) | null = null;
let g_unsubStop: (() => void) | null = null;

export function init(): void {
  if (g_initialized) {
    return;
  }
  g_initialized = true;
  g_unsubReady = addStreamListener('control_ready', _onControlReady);
  g_unsubStop = addStreamListener('control_stop', _onControlStop);
}

export function stop(): void {
  _onControlStop();
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

export function addListener(
  event: 'ready' | 'stop',
  callback: () => void
): () => void {
  g_eventEmitter.on(event, callback);
  return () => {
    g_eventEmitter.removeListener(event, callback);
  };
}

function _onControlReady(): void {
  g_sequence = 0;
  g_active = true;
  _sendClientMetadata();
  log('webrtc_input_handler: control_ready, active');
  g_eventEmitter.emit('ready');
}

function _onControlStop(): void {
  const wasActive = g_active;
  g_active = false;
  g_sequence = 0;
  log('webrtc_input_handler: control_stop, inactive');
  if (wasActive) {
    g_eventEmitter.emit('stop');
  }
}

export function announceGamepad(slot: 0 | 1 | 2 | 3, added: boolean): void {
  if (!g_active) {
    return;
  }
  sendControlMessage({
    message: 'gamepadChanged',
    gamepadIndex: slot,
    wasAdded: added,
  });
  traceLog('webrtc_input_handler: gamepadChanged slot:', slot, 'added:', added);
}

function _sendClientMetadata(): void {
  if (!g_active) {
    return;
  }
  const buf = new ArrayBuffer(15);
  const view = new DataView(buf);
  view.setUint16(0, REPORT_CLIENT_METADATA, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);
  view.setUint8(14, 0);
  sendInputFrame(new Uint8Array(buf));
  traceLog('webrtc_input_handler: sent client metadata');
}

export function sendGamepadState(
  slot: 0 | 1 | 2 | 3,
  buttons: number,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
  leftTrigger: number,
  rightTrigger: number
): void {
  if (!g_active) {
    return;
  }

  const lx = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, leftX));
  const ly = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, leftY));
  const rx = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, rightX));
  const ry = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, rightY));
  const lt = Math.max(0, Math.min(TRIGGER_MAX, leftTrigger));
  const rt = Math.max(0, Math.min(TRIGGER_MAX, rightTrigger));

  const buf = new ArrayBuffer(38);
  const view = new DataView(buf);

  view.setUint16(0, REPORT_GAMEPAD, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);
  view.setUint8(14, 1);

  view.setUint8(15, slot);
  view.setUint16(16, buttons, true);
  view.setInt16(18, lx, true);
  view.setInt16(20, -ly, true);
  view.setInt16(22, rx, true);
  view.setInt16(24, -ry, true);
  view.setUint16(26, lt, true);
  view.setUint16(28, rt, true);
  view.setUint32(30, 1, true);
  view.setUint32(34, 1, false);

  traceLog(
    'webrtc_input_handler: sendGamepadState slot:',
    slot,
    'buttons:',
    buttons
  );
  sendInputFrame(new Uint8Array(buf));
}

export function sendKeyDown(scanCode: number): void {
  if (!g_active) {
    return;
  }
  _sendKeyFrame(scanCode, true);
}

export function sendKeyUp(scanCode: number): void {
  if (!g_active) {
    return;
  }
  _sendKeyFrame(scanCode, false);
}

function _sendKeyFrame(scanCode: number, isDown: boolean): void {
  const buf = new ArrayBuffer(19);
  const view = new DataView(buf);
  view.setUint16(0, REPORT_KEYBOARD, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);
  view.setUint8(14, isDown ? 1 : 0);
  view.setUint32(15, scanCode, true);
  sendInputFrame(new Uint8Array(buf));
  traceLog('webrtc_input_handler: key', isDown ? 'down' : 'up', scanCode);
}

export function sendMouseDelta(dx: number, dy: number, buttons: number): void {
  if (!g_active) {
    return;
  }
  const buf = new ArrayBuffer(26);
  const view = new DataView(buf);
  view.setUint16(0, REPORT_MOUSE, true);
  view.setUint32(2, g_sequence++, true);
  view.setFloat64(6, performance.now(), true);
  view.setFloat32(14, dx, true);
  view.setFloat32(18, dy, true);
  view.setUint32(22, buttons, true);
  sendInputFrame(new Uint8Array(buf));
  traceLog('webrtc_input_handler: mouse dx:', dx, 'dy:', dy);
}

export function isActive(): boolean {
  return g_active;
}

export default {
  init,
  stop,
  addListener,
  announceGamepad,
  sendGamepadState,
  sendKeyDown,
  sendKeyUp,
  sendMouseDelta,
  isActive,
};
