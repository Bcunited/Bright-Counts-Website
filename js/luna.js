// Luna runs while the page scrolls and sits when it stops. Decorative only.
(function () {
  var el = document.querySelector('.luna');
  var header = document.querySelector('.site-header');
  if (!el || !header || !window.LunaMath) return;

  var sprite = el.firstElementChild;
  var inner = header.querySelector('.header-inner');
  var fill = header.querySelector('.luna-fill');
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var IDLE_MS = 450;

  var geom;
  var progress = 0;
  var lastY = window.pageYOffset;
  var facing = 1;
  var running = false;
  var idleTimer = null;
  var frame = null;

  // Preload the second sitting frame so the tail wag does not flicker on first use.
  new Image().src = 'assets/luna-sit-2.png';

  function measure() {
    var r = inner.getBoundingClientRect();
    var cs = getComputedStyle(inner);
    geom = {
      W: root.clientWidth,
      cl: r.left + parseFloat(cs.paddingLeft),
      cr: r.right - parseFloat(cs.paddingRight),
      w: 0
    };
    root.classList.remove('luna-narrow');
    geom.w = el.offsetWidth;
    if (!LunaMath.isWide(geom)) {
      root.classList.add('luna-narrow');
      geom.w = el.offsetWidth;
    }
  }

  function readProgress() {
    var max = root.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
  }

  function render() {
    var s = LunaMath.position(progress, geom, !running);
    el.style.transform = 'translate3d(' + s.x + 'px,0,0)';
    el.style.clipPath = 'inset(0 ' + s.clipR + 'px 0 ' + s.clipL + 'px)';
    el.classList.toggle('is-idle', !running);
    sprite.className = 'luna-sprite ' + (running ? 'is-run' : 'is-sit');
    sprite.style.transform = running && facing < 0 ? 'scaleX(-1)' : '';
    if (fill) fill.style.width = progress * 100 + '%';
  }

  function onScroll() {
    if (reduceMotion.matches) return;
    var y = window.pageYOffset;
    if (Math.abs(y - lastY) > 1) facing = y > lastY ? 1 : -1;
    lastY = y;
    running = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { running = false; render(); }, IDLE_MS);
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = null;
      progress = readProgress();
      render();
    });
  }

  function onResize() {
    measure();
    render();
  }

  measure();
  progress = reduceMotion.matches ? 0 : readProgress();
  render();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
})();
