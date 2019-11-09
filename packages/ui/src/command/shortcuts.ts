import {isWindows} from '@condict/platform';

import {Shortcut} from './shortcut';

export const Shortcuts = Object.freeze({
  undo: Shortcut.parse('Primary+Z z'),
  redo: Shortcut.parse(isWindows ? 'Primary+Y y' : 'Primary+Shift+Z z'),

  cut: Shortcut.parse('Primary+X x'),
  copy: Shortcut.parse('Primary+C c'),
  paste: Shortcut.parse('Primary+V v'),

  selectAll: Shortcut.parse('Primary+A a'),
});
