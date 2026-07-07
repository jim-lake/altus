import { useSyncExternalStore } from 'react';

import {
  addListener,
  startCapture as processorStartCapture,
  stopCapture as processorStopCapture,
} from '@/lib/gamepad/input_processor';

let g_captured = false;

const g_listeners = new Set<() => void>();

function _emit(): void {
  for (const listener of g_listeners) {
    listener();
  }
}

function _subscribe(callback: () => void): () => void {
  g_listeners.add(callback);
  return () => {
    g_listeners.delete(callback);
  };
}

function _getSnapshot(): boolean {
  return g_captured;
}

export function init(): void {
  addListener('start_capture', _onStartCapture);
  addListener('stop_capture', _onStopCapture);
}

function _onStartCapture(): void {
  g_captured = true;
  _emit();
}

function _onStopCapture(): void {
  g_captured = false;
  _emit();
}

export function startCapture(): void {
  processorStartCapture();
}

export function stopCapture(): void {
  processorStopCapture();
}

export function isCaptured(): boolean {
  return g_captured;
}

export function useCaptured(): boolean {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}

export default { init, startCapture, stopCapture, isCaptured, useCaptured };
