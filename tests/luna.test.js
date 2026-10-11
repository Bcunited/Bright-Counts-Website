const test = require('node:test');
const assert = require('node:assert');
const { PAD, isWide, position } = require('../js/luna-math.js');

const wide = { W: 1920, cl: 400, cr: 1520, w: 62 };
const laptop = { W: 1280, cl: 120, cr: 1160, w: 62 };
const phone = { W: 375, cl: 20, cr: 355, w: 44 };

const sweep = (fn) => { for (let i = 0; i <= 1000; i++) fn(i / 1000); };

test('wide mode needs room for Luna on both sides', () => {
  assert.ok(isWide(wide));
  assert.ok(isWide(laptop));
  assert.ok(!isWide(phone));
  assert.ok(!isWide({ ...laptop, cl: 70 }));
});

test('narrow mode makes one pass from start to end with nothing clipped', () => {
  assert.strictEqual(position(0, phone, false).x, PAD);
  assert.strictEqual(position(1, phone, false).x, phone.W - phone.w - PAD);
  let prev = -Infinity;
  sweep((p) => {
    const s = position(p, phone, false);
    assert.ok(s.x >= prev);
    assert.strictEqual(s.clipL + s.clipR, 0);
    prev = s.x;
  });
});

test('wide mode starts in the left space and ends in the right space', () => {
  const start = position(0, wide, true);
  const end = position(1, wide, true);
  assert.strictEqual(start.x, PAD);
  assert.strictEqual(end.x, wide.W - wide.w - PAD);
});

test('while running, the visible part never overlaps the header content', () => {
  for (const g of [wide, laptop]) {
    sweep((p) => {
      const s = position(p, g, false);
      const visibleStart = s.x + s.clipL;
      const visibleEnd = s.x + g.w - s.clipR;
      if (visibleEnd > visibleStart) {
        assert.ok(visibleEnd <= g.cl + 1e-9 || visibleStart >= g.cr - 1e-9, `p=${p} overlaps content`);
      }
    });
  }
});

test('she is fully hidden when behind the content edge, not popping in mid-header', () => {
  const justBefore = position(0.499, wide, false);
  const justAfter = position(0.501, wide, false);
  assert.ok(justBefore.clipR > wide.w * 0.9);
  assert.ok(justAfter.clipL > wide.w * 0.9);
});

test('when idle she is never clipped and never sits on the content', () => {
  for (const g of [wide, laptop]) {
    sweep((p) => {
      const s = position(p, g, true);
      assert.strictEqual(s.clipL + s.clipR, 0);
      assert.ok(s.x + g.w <= g.cl + 1e-9 || s.x >= g.cr - 1e-9, `p=${p} sits on content`);
      assert.ok(s.x >= PAD && s.x + g.w <= g.W - PAD, `p=${p} off screen`);
    });
  }
});

test('idle snap lands on the side she was heading from', () => {
  assert.strictEqual(position(0.49, wide, true).x, wide.cl - wide.w - PAD);
  assert.strictEqual(position(0.51, wide, true).x, wide.cr + PAD);
});

test('progress outside 0..1 is clamped', () => {
  assert.deepStrictEqual(position(-5, wide, true), position(0, wide, true));
  assert.deepStrictEqual(position(9, wide, true), position(1, wide, true));
});
