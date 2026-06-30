// focus-trap.test.ts — vanilla focus trap для Modal primitives.
//
// Покрытие:
//   • На creation: focus уходит на первый focusable внутри container.
//   • Container без focusable'ов получает tabindex=-1 + focus.
//   • Tab от last focusable → wraps в first.
//   • Shift+Tab от first → wraps в last.
//   • Tab от outside container → tab захватывается, focus уходит в first.
//   • release() — снимает keydown listener.
//   • release() — восстанавливает focus на previouslyFocused (если в DOM).
//   • release() — не throw'ит если previouslyFocused был removed из DOM.
//   • Disabled / inert / aria-hidden=true элементы исключаются из focusable списка.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createFocusTrap, type FocusTrap } from '../focus-trap';

let container: HTMLDivElement;
let traps: FocusTrap[] = [];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  // Release everything we created so listeners don't leak across tests.
  for (const t of traps) {
    try {
      t.release();
    } catch {
      /* already released */
    }
  }
  traps = [];
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

function mkTrap(c: HTMLElement): FocusTrap {
  const t = createFocusTrap(c);
  traps.push(t);
  return t;
}

// happy-dom не реализует HTMLElement.offsetParent в полной mere — он
// возвращает null для отсоединённых nodes но «works» для elements в DOM.
// Если в окружении offsetParent ведёт себя иначе, override его на чтение
// parent'а, чтобы focus-trap считал кнопки видимыми.
function ensureOffsetParent(el: HTMLElement): void {
  if (el.offsetParent === null && el.parentElement) {
    Object.defineProperty(el, 'offsetParent', {
      configurable: true,
      get: () => el.parentElement,
    });
  }
}

function dispatchTab(shift = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  return ev;
}

describe('createFocusTrap — initial focus', () => {
  it('focuses first focusable inside container', () => {
    const b1 = document.createElement('button');
    b1.textContent = 'first';
    const b2 = document.createElement('button');
    b2.textContent = 'second';
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);

    mkTrap(container);
    expect(document.activeElement).toBe(b1);
  });

  it('falls back to container itself when no focusables (tabindex=-1)', () => {
    container.appendChild(document.createElement('p')); // not focusable
    mkTrap(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(container);
  });

  it('keeps existing tabindex if container already has one', () => {
    container.setAttribute('tabindex', '0');
    container.appendChild(document.createElement('span'));
    mkTrap(container);
    // Не перезаписываем pre-existing tabindex, container всё-равно получает focus.
    expect(container.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(container);
  });
});

describe('createFocusTrap — Tab wrapping', () => {
  it('Tab from last focusable wraps back to first', () => {
    const b1 = document.createElement('button');
    const b2 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);

    mkTrap(container);
    b2.focus();
    expect(document.activeElement).toBe(b2);
    const ev = dispatchTab(false);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b1);
  });

  it('Shift+Tab from first focusable wraps to last', () => {
    const b1 = document.createElement('button');
    const b2 = document.createElement('button');
    const b3 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    container.appendChild(b3);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);
    ensureOffsetParent(b3);

    mkTrap(container);
    expect(document.activeElement).toBe(b1);
    const ev = dispatchTab(true);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b3);
  });

  it('Tab pressed when focus is outside container — pulls focus back to first', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    ensureOffsetParent(outside);

    const inner = document.createElement('button');
    container.appendChild(inner);
    ensureOffsetParent(inner);

    mkTrap(container);
    outside.focus(); // явно выходим
    expect(document.activeElement).toBe(outside);

    const ev = dispatchTab(false);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inner);
  });

  it('non-Tab keys are ignored (no preventDefault)', () => {
    const b1 = document.createElement('button');
    container.appendChild(b1);
    ensureOffsetParent(b1);
    mkTrap(container);
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('empty focusable set — Tab is swallowed (preventDefault only)', () => {
    container.appendChild(document.createElement('p'));
    mkTrap(container);
    const ev = dispatchTab(false);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('createFocusTrap — release', () => {
  it('restores focus to previouslyFocused if still in DOM', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    ensureOffsetParent(before);
    before.focus();
    expect(document.activeElement).toBe(before);

    const b1 = document.createElement('button');
    container.appendChild(b1);
    ensureOffsetParent(b1);

    const trap = mkTrap(container);
    expect(document.activeElement).toBe(b1);

    trap.release();
    expect(document.activeElement).toBe(before);
  });

  it('no throw if previouslyFocused was removed from DOM', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    ensureOffsetParent(before);
    before.focus();

    const inner = document.createElement('button');
    container.appendChild(inner);
    ensureOffsetParent(inner);

    const trap = mkTrap(container);
    before.remove();
    expect(() => trap.release()).not.toThrow();
    // previouslyFocused был удалён → focus не восстанавливается на него.
    expect(document.activeElement).not.toBe(before);
  });

  it('after release Tab no longer wraps (listener detached)', () => {
    const b1 = document.createElement('button');
    const b2 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);

    const trap = mkTrap(container);
    trap.release();
    b2.focus();
    const ev = dispatchTab(false);
    // После release нет preventDefault → нативный browser handle (no-op в JSDOM).
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('createFocusTrap — focusable filtering', () => {
  it('disabled buttons are excluded', () => {
    const b1 = document.createElement('button');
    b1.disabled = true;
    const b2 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b2);
    mkTrap(container);
    expect(document.activeElement).toBe(b2);
  });

  it('aria-hidden=true elements are excluded', () => {
    const b1 = document.createElement('button');
    b1.setAttribute('aria-hidden', 'true');
    const b2 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);
    mkTrap(container);
    expect(document.activeElement).toBe(b2);
  });

  it('inert elements are excluded', () => {
    const b1 = document.createElement('button');
    b1.setAttribute('inert', '');
    const b2 = document.createElement('button');
    container.appendChild(b1);
    container.appendChild(b2);
    ensureOffsetParent(b1);
    ensureOffsetParent(b2);
    mkTrap(container);
    expect(document.activeElement).toBe(b2);
  });

  it('div[tabindex=-1] is excluded but div[tabindex=0] is included', () => {
    // Используем div: button matches `button:not([disabled])` selector
    // независимо от tabindex. div ловится только через [tabindex]:not([-1]).
    const skipped = document.createElement('div');
    skipped.setAttribute('tabindex', '-1');
    const included = document.createElement('div');
    included.setAttribute('tabindex', '0');
    container.appendChild(skipped);
    container.appendChild(included);
    ensureOffsetParent(skipped);
    ensureOffsetParent(included);
    mkTrap(container);
    expect(document.activeElement).toBe(included);
  });

  it('multiple focusable types — anchor, input, textarea, select detected', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '#');
    const input = document.createElement('input');
    const ta = document.createElement('textarea');
    const sel = document.createElement('select');
    container.appendChild(a);
    container.appendChild(input);
    container.appendChild(ta);
    container.appendChild(sel);
    [a, input, ta, sel].forEach(ensureOffsetParent);
    mkTrap(container);
    // first focusable = the anchor.
    expect(document.activeElement).toBe(a);

    // Tab cycle: a → input → ta → sel → wrap a.
    dispatchTab(false);
    expect(document.activeElement).toBe(a); // happy-dom: native tab focus not advanced; only wrap preventDefault triggers.

    sel.focus();
    const ev = dispatchTab(false);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
  });
});
