const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('app/globals.css', 'utf8');
assert.match(css, /--color-popover:\s*var\(--popover\)/);
assert.match(css, /--color-popover-foreground:\s*var\(--popover-foreground\)/);
assert.match(css, /--popover:\s*#ffffff\s*;/);
assert.match(css, /--popover-foreground:\s*#172d44\s*;/);
for (const type of ['dialog', 'alert-dialog']) {
  const component = fs.readFileSync(`components/ui/${type}.tsx`, 'utf8');
  assert.ok(component.includes(`data-slot="${type}-content"`));
  assert.ok(component.includes('bg-popover'));
  assert.ok(css.includes(`[data-slot="${type}-content"]`));
  assert.ok(css.includes(`[data-slot="${type}-overlay"]`));
}
assert.match(css, /background-color:\s*var\(--popover\)/);
assert.match(css, /background-color:\s*rgb\(15 23 42 \/ 50%\)/);
console.log('PASS: opaque popup tokens and shared dialog/alert-dialog surfaces with darker backdrops');
