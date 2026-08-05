import { useEffect, useRef } from 'react';

/**
 * Android-style back navigation for a single-page app.
 *
 * Browser history is the source of truth: every dismissible surface (modal,
 * bottom sheet, non-start tab) owns exactly one history entry. Pressing the
 * hardware/gesture back button pops the entry, which dismisses the surface that
 * was opened most recently — true LIFO, regardless of render order.
 *
 * Dismissing a surface from the UI instead (X button, overlay tap) unwinds its
 * history entry, so the two paths can never drift apart.
 *
 * At the root — nothing open, start tab showing — back arms a short window and
 * asks for confirmation. A second back inside that window detaches the handler
 * and leaves the app, matching Android's "press back again to exit".
 */

const EXIT_WINDOW_MS = 2000;

interface Layer {
  id: number;
  dismiss: () => void;
}

let layers: Layer[] = [];
let nextLayerId = 1;

/**
 * Number of history.back() calls we made ourselves. Their popstate events are
 * bookkeeping, not user intent, so they must not dismiss anything.
 */
let selfBacks = 0;

let started = false;
let exitArmedUntil = 0;
let exitPrompt: (() => void) | null = null;

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
    // The entry this layer owned is already gone, so history depth and layer
    // count stay in step without re-pushing.
    top.dismiss();
    return;
  }

  const now = Date.now();
  if (now < exitArmedUntil) {
    // Confirmed. Stop intercepting and let the app fall out of history.
    stopBackNavigation();
    history.back();
    return;
  }

  exitArmedUntil = now + EXIT_WINDOW_MS;
  history.pushState(depthState(), '');
  exitPrompt?.();
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  // Escape closes surfaces but never exits the app.
  if (layers.length === 0) return;
  event.preventDefault();
  history.back();
}

export function startBackNavigation() {
  if (started) return;
  started = true;
  exitArmedUntil = 0;
  // Sentinel entry: without one, the first back leaves the app before any
  // popstate fires and we get no chance to intercept it.
  history.pushState(depthState(), '');
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown);
}

export function stopBackNavigation() {
  if (!started) return;
  started = false;
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('keydown', handleKeyDown);
}

/** Called when the user presses back at the root. Show a "press again" hint. */
export function setExitPromptHandler(handler: (() => void) | null) {
  exitPrompt = handler;
}

function registerLayer(dismiss: () => void): Layer {
  startBackNavigation();
  // Opening something is fresh intent; drop any half-armed exit.
  exitArmedUntil = 0;
  const layer: Layer = { id: nextLayerId++, dismiss };
  layers.push(layer);
  history.pushState(depthState(), '');
  return layer;
}

function releaseLayer(layer: Layer) {
  const index = layers.indexOf(layer);
  // Already gone means a back press consumed it and its history entry.
  if (index === -1) return;
  layers.splice(index, 1);
  selfBacks++;
  history.back();
}

/**
 * Register a dismissible surface with the back stack.
 *
 * While `isOpen` is true the surface holds one history entry, so back dismisses
 * it instead of leaving the app. `onDismiss` is read through a ref, so it never
 * needs to be memoised and never re-registers the layer.
 */
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

/**
 * Put tab switches on the back stack, so back retraces the tabs the user
 * visited instead of silently exiting the app.
 *
 * Revisiting a tab that is already on the stack unwinds to it rather than
 * stacking a duplicate, so bouncing between two tabs can't grow history without
 * bound. Returning to `startTab` clears the stack, matching Android's
 * start-destination behaviour.
 *
 * Tab layers share one stack with modals, so a modal opened inside a tab always
 * closes before the tab itself is popped.
 */
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

    // This change came from a back press; its layer is already gone.
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    const stack = stackRef.current;
    const unwindTo = activeTab === startTab
      ? 0
      : stack.findIndex(entry => entry.tab === activeTab);

    if (unwindTo !== -1) {
      // Drop the entries above the target, newest first, so history depth
      // unwinds in the same order it was built.
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

  // Releasing on unmount keeps the shared stack clean across logout.
  useEffect(() => {
    return () => {
      const stack = stackRef.current;
      for (let i = stack.length - 1; i >= 0; i--) releaseLayer(stack[i].layer);
      stackRef.current = [];
    };
  }, []);
}
