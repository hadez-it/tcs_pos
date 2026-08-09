import { useEffect, useRef } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';

const EXIT_WINDOW_MS = 2000;

interface Layer {
  id: number;
  dismiss: () => void;
}

let layers: Layer[] = [];
let nextLayerId = 1;
let selfBacks = 0;
let started = false;
let exitArmedUntil = 0;
let exitPrompt: (() => void) | null = null;
let appListenerHandle: PluginListenerHandle | null = null;

function depthState() {
  return { __posDepth: layers.length };
}

function handlePopState() {
  if (selfBacks > 0) {
    selfBacks--;
    return;
  }

  const top = layers.pop();
  if (top) {
    top.dismiss();
    return;
  }

  const now = Date.now();
  if (now < exitArmedUntil) {
    stopBackNavigation();
    if (Capacitor.isNativePlatform()) {
      App.exitApp();
    } else {
      history.back();
    }
    return;
  }

  exitArmedUntil = now + EXIT_WINDOW_MS;
  history.pushState(depthState(), '');
  exitPrompt?.();
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (layers.length === 0) return;
  event.preventDefault();
  history.back();
}

function handleCapacitorBackButton() {
  if (layers.length > 0) {
    history.back();
    return;
  }

  const now = Date.now();
  if (now < exitArmedUntil) {
    stopBackNavigation();
    App.exitApp();
    return;
  }

  exitArmedUntil = now + EXIT_WINDOW_MS;
  exitPrompt?.();
}

export function startBackNavigation() {
  if (started) return;
  started = true;
  exitArmedUntil = 0;
  history.pushState(depthState(), '');
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown);

  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', handleCapacitorBackButton).then(handle => {
      appListenerHandle = handle;
    });
  }
}

export function stopBackNavigation() {
  if (!started) return;
  started = false;
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('keydown', handleKeyDown);

  if (appListenerHandle) {
    appListenerHandle.remove();
    appListenerHandle = null;
  }
}

export function setExitPromptHandler(handler: (() => void) | null) {
  exitPrompt = handler;
}

function registerLayer(dismiss: () => void): Layer {
  startBackNavigation();
  exitArmedUntil = 0;
  const layer: Layer = { id: nextLayerId++, dismiss };
  layers.push(layer);
  history.pushState(depthState(), '');
  return layer;
}

function releaseLayer(layer: Layer) {
  const index = layers.indexOf(layer);
  if (index === -1) return;
  layers.splice(index, 1);
  selfBacks++;
  history.back();
}

export function useBackDismiss(isOpen: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!isOpen) return;
    const layer = registerLayer(() => dismissRef.current());
    return () => releaseLayer(layer);
  }, [isOpen]);
}

export function useBackTabHistory<T extends string>(
  activeTab: T,
  onRestore: (tab: T) => void,
  startTab: T,
) {
  const restoreRef = useRef(onRestore);
  const stackRef = useRef<{ tab: T; layer: Layer }[]>([]);
  const previousTabRef = useRef(activeTab);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    restoreRef.current = onRestore;
  });

  useEffect(() => {
    const leaving = previousTabRef.current;
    if (leaving === activeTab) return;
    previousTabRef.current = activeTab;

    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    const stack = stackRef.current;
    const unwindTo = activeTab === startTab
      ? 0
      : stack.findIndex(entry => entry.tab === activeTab);

    if (unwindTo !== -1) {
      const dropped = stack.splice(unwindTo);
      for (let i = dropped.length - 1; i >= 0; i--) releaseLayer(dropped[i].layer);
      return;
    }

    const layer = registerLayer(() => {
      const index = stackRef.current.findIndex(entry => entry.layer === layer);
      if (index !== -1) stackRef.current.splice(index, 1);
      isRestoringRef.current = true;
      restoreRef.current(leaving);
    });
    stack.push({ tab: leaving, layer });
  }, [activeTab, startTab]);

  useEffect(() => {
    return () => {
      const stack = stackRef.current;
      for (let i = stack.length - 1; i >= 0; i--) releaseLayer(stack[i].layer);
      stackRef.current = [];
    };
  }, []);
}
