(function() {
  'use strict';
  // Where this script was loaded from is the site root: currentScript, or
  // (an engine that lost it) the page's own tag for this file.
  var me = document.currentScript || document.querySelector('script[src$="preview.js"]');
  if (!me || !me.src || typeof URL !== 'function') return;
  var ROOT = new URL('.', me.src).href;
  var OPEN_DELAY = 250, GRACE = 180, GAP = 6, MARGIN = 8, TIP_ID = 'minerva-link-preview';
  var data = null, loader = null, waiting = [];
  var tip = null, titleEl = null, snippetEl = null;
  var anchor = null, wanted = null, openTimer = 0, closeTimer = 0;

  function load(cb) {
    if (data) { cb(); return; }
    waiting.push(cb);
    if (loader) return;
    loader = document.createElement('script');
    loader.src = ROOT + 'previews.js';
    loader.async = true;
    var done = function() {
      var d = window.__minervaLinkPreviews;
      data = d && typeof d === 'object' ? d : {};
      var q = waiting; waiting = [];
      for (var i = 0; i < q.length; i++) q[i]();
    };
    loader.onload = done;
    loader.onerror = done;
    document.head.appendChild(loader);
  }

  function decode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function bare(u) { var c = new URL(u.href); c.hash = ''; c.search = ''; return c.href; }

  /** The preview for a link, by where its href lands; null for none. */
  function previewFor(a) {
    var raw = a.getAttribute('href');
    if (!raw || !data) return null;
    var url = null;
    try { url = new URL(raw, location.href); } catch (e) { url = null; }
    if (!url) return null;
    var page = bare(url);
    if (page.indexOf(ROOT) !== 0) return null;
    var key = decode(page.slice(ROOT.length));
    var frag = url.hash ? decode(url.hash.slice(1)) : '';
    var has = Object.prototype.hasOwnProperty;
    if (frag && has.call(data, key + '#' + frag)) return data[key + '#' + frag];
    // A same-page link (a footnote, a heading anchor) is not a note link.
    if (page === bare(new URL(location.href))) return null;
    return has.call(data, key) ? data[key] : null;
  }

  function linkFrom(target) {
    if (!target || !target.closest) return null;
    var a = target.closest('a[href]');
    if (!a || (tip && tip.contains(a))) return null;
    return a.closest('main, article') ? a : null;
  }

  function ensureTip() {
    if (tip) return;
    tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.className = 'minerva-link-preview';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    titleEl = document.createElement('div');
    titleEl.className = 'mlp-title';
    snippetEl = document.createElement('div');
    snippetEl.className = 'mlp-snippet';
    tip.appendChild(titleEl);
    tip.appendChild(snippetEl);
    tip.addEventListener('pointerenter', function() { clearTimeout(closeTimer); });
    tip.addEventListener('pointerleave', function() { scheduleClose(); });
    document.body.appendChild(tip);
  }

  function describe(a, on) {
    var ids = (a.getAttribute('aria-describedby') || '').split(/\s+/).filter(function(t) { return t && t !== TIP_ID; });
    if (on) ids.push(TIP_ID);
    if (ids.length) a.setAttribute('aria-describedby', ids.join(' '));
    else a.removeAttribute('aria-describedby');
  }

  function place() {
    if (!tip || !anchor || tip.hidden) return;
    if (!anchor.isConnected) { close(); return; }
    var r = anchor.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var below = r.bottom + GAP, above = r.top - GAP - h;
    var top = (below + h <= vh - MARGIN || above < MARGIN) ? Math.max(MARGIN, Math.min(below, vh - MARGIN - h)) : above;
    var left = Math.max(MARGIN, Math.min(r.left, vw - MARGIN - w));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function open(a) {
    wanted = a;
    load(function() {
      if (wanted !== a) return;
      var p = previewFor(a);
      if (!p) return;
      ensureTip();
      if (anchor && anchor !== a) describe(anchor, false);
      clearTimeout(closeTimer);
      anchor = a;
      titleEl.textContent = String(p.t || '');
      snippetEl.textContent = String(p.s || '') || '(empty note)';
      tip.hidden = false;
      describe(a, true);
      place();
    });
  }

  function close() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    wanted = null;
    if (anchor) describe(anchor, false);
    anchor = null;
    if (tip) tip.hidden = true;
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, GRACE);
  }

  document.addEventListener('pointerover', function(e) {
    var a = linkFrom(e.target);
    if (!a) return;
    if (a === anchor) { clearTimeout(closeTimer); return; }
    if (a === wanted) return;
    clearTimeout(openTimer);
    wanted = a;
    openTimer = setTimeout(function() { open(a); }, OPEN_DELAY);
  });
  document.addEventListener('pointerout', function(e) {
    var a = linkFrom(e.target);
    if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    if (a === anchor) { scheduleClose(); return; }
    if (a === wanted) { clearTimeout(openTimer); wanted = null; }
  });
  document.addEventListener('focusin', function(e) {
    var a = linkFrom(e.target);
    if (!a) return;
    var keyboard = true;
    try { keyboard = a.matches(':focus-visible'); } catch (err) { /* older engine: treat as keyboard */ }
    if (keyboard) { clearTimeout(openTimer); open(a); }
  });
  document.addEventListener('focusout', function(e) {
    if (e.target === anchor || e.target === wanted) close();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && (anchor || wanted)) close();
  }, true);
  document.addEventListener('pointerdown', function(e) {
    if (anchor && !(tip && tip.contains(e.target))) close();
  }, true);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
})();
