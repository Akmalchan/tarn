/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Radio groups (role="radiogroup" with role="radio" buttons) that behave
// like the system's: the group is one Tab stop, on the chosen option, and
// the arrow keys move to the next option and choose it. One helper for
// every group in the panel, so each stays plain markup.

/** Where an arrow key moves among `count` options, or null for other keys. */
export function radioStep(
  key: string,
  index: number,
  count: number,
): number | null {
  if (count < 1) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

function radiosOf(group: Element): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
    radio => radio.closest('[role="radiogroup"]') === group,
  );
}

/**
 * Roving tabindex: in each group under `root`, only the chosen radio (or
 * the first, when none is) is reached with Tab. Call after every render.
 */
export function roveRadios(root: ParentNode): void {
  for (const group of root.querySelectorAll('[role="radiogroup"]')) {
    const radios = radiosOf(group);
    const chosen =
      radios.find(radio => radio.getAttribute('aria-checked') === 'true') ??
      radios[0];
    for (const radio of radios) radio.tabIndex = radio === chosen ? 0 : -1;
  }
}

/**
 * Arrow keys, Home and End in a radio group: focus the option and choose
 * it, as its click does. Listen for keydown on a root that holds groups.
 */
export function onRadioKey(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const radio = (event.composedPath()[0] as Element | undefined)?.closest?.(
    '[role="radio"]',
  );
  const group = radio?.closest('[role="radiogroup"]');
  if (!radio || !group) return;
  const radios = radiosOf(group);
  const next = radioStep(
    event.key,
    radios.indexOf(radio as HTMLElement),
    radios.length,
  );
  if (next === null) return;
  event.preventDefault();
  const target = radios[next]!;
  target.focus();
  if (target.getAttribute('aria-checked') !== 'true') target.click();
}
