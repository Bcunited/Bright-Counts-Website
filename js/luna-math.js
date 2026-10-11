// Pure position logic for the Luna runner. No DOM access, so node can test it.
// Geometry g: W viewport width, cl and cr the left and right edge of the header content, w Luna's width.
(function (root) {
  var PAD = 10;

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Wide mode needs room for Luna on both sides of the header content.
  function isWide(g) {
    return g.cl >= g.w + 2 * PAD && g.W - g.cr >= g.w + 2 * PAD;
  }

  // Wide: she runs the left space during the first half of the page, slips behind the content edge,
  // and comes out of the right edge for the second half. Narrow: one pass along the ribbon.
  // When idle she snaps clear of the content so she never sits half hidden.
  function position(p, g, idle) {
    p = Math.min(1, Math.max(0, p));
    if (!isWide(g)) return { x: lerp(PAD, g.W - g.w - PAD, p), clipL: 0, clipR: 0, wide: false };

    var left = p < 0.5;
    var x = left ? lerp(PAD, g.cl, p / 0.5) : lerp(g.cr - g.w, g.W - g.w - PAD, (p - 0.5) / 0.5);
    var clipL = 0;
    var clipR = 0;
    if (x + g.w > g.cl && x < g.cr) {
      if (idle) x = left ? g.cl - g.w - PAD : g.cr + PAD;
      else if (left) clipR = Math.min(g.w, x + g.w - g.cl);
      else clipL = Math.min(g.w, g.cr - x);
    }
    return { x: x, clipL: clipL, clipR: clipR, wide: true };
  }

  var api = { PAD: PAD, isWide: isWide, position: position };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LunaMath = api;
})(this);
