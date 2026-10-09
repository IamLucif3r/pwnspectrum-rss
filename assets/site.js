(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var edition = body.getAttribute('data-edition');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function track(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); }
  function scrollToEl(el, block) { el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: block || 'start' }); }
  function typing(t) { return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }
  function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  if (/[?&]debug=1/.test(location.search)) body.classList.add('debug');

  // Keyboard-only highlight: shown after a key press, hidden on pointer use.
  document.addEventListener('keydown', function (e) { if (!e.metaKey && !e.ctrlKey && !e.altKey) root.classList.add('kbd'); }, true);
  document.addEventListener('pointerdown', function () { root.classList.remove('kbd'); }, true);

  // ---------------- Theme ----------------
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pwn_theme', next); } catch (e) {}
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < meta.length; i++) meta[i].setAttribute('content', next === 'dark' ? '#111110' : '#f7f5f0');
    track('theme_toggle', { theme: next });
  }
  var themeBtn = $('#theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // ---------------- Scroll: progress line, back to top ----------------
  var line = $('#scroll-line'), toTop = $('#to-top'), ticking = false;
  function onScroll() {
    ticking = false;
    var h = root.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    if (line) line.style.transform = 'scaleX(' + p + ')';
    if (toTop) toTop.classList.toggle('show', window.scrollY > window.innerHeight * 1.5);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    var wm = $('.wordmark'); if (wm) wm.focus({ preventScroll: true });
  });

  // ---------------- Keyboard dialog ----------------
  var keys = $('#keys');
  function openKeys() { if (keys && typeof keys.showModal === 'function' && !keys.open) keys.showModal(); }
  if ($('#keys-btn')) $('#keys-btn').addEventListener('click', openKeys);
  if (keys) keys.addEventListener('click', function (e) { if (e.target === keys) keys.close(); });

  if (!edition) {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === 'd') toggleTheme();
      if (e.key === '?') openKeys();
    });
    return;
  }

  // ================= Edition page =================
  var stories = $$('li.story');
  var ids = stories.map(function (s) { return s.getAttribute('data-story'); });

  // ---------------- Read tracking ----------------
  var readKey = 'pwn_read_' + edition;
  var read = store.get(readKey, []);
  var readOut = $('#bar-read');
  var done = $('#done');
  function renderRead() {
    var n = 0;
    stories.forEach(function (s) {
      var on = read.indexOf(s.getAttribute('data-story')) !== -1;
      s.classList.toggle('is-read', on);
      if (on) n++;
    });
    $$('.top3-list li').forEach(function (li) { li.classList.toggle('is-read', read.indexOf(li.getAttribute('data-story')) !== -1); });
    if (readOut) { readOut.textContent = n + ' of ' + stories.length + ' read'; readOut.hidden = n === 0; }
    if (done) {
      var all = n === stories.length && n > 0;
      done.classList.toggle('all-read', all);
      var dt = $('#done-title');
      if (dt) dt.textContent = all ? "You're caught up." : "That's today's brief.";
    }
  }
  function markRead(id) {
    if (!id || read.indexOf(id) !== -1) return;
    read.push(id);
    store.set(readKey, read);
    renderRead();
    if (read.length === stories.length) track('caught_up', { stories: stories.length });
  }
  // Stories opened by "expand all" are not counted as read.
  var bulkOpened = typeof WeakSet === 'function' ? new WeakSet() : { has: function () { return false; }, add: function () {}, delete: function () {} };
  stories.forEach(function (s) {
    var det = $('details', s);
    det.addEventListener('toggle', function () {
      if (bulkOpened.has(det)) { bulkOpened.delete(det); return; }
      if (det.open) {
        markRead(s.getAttribute('data-story'));
        track('story_open', { section: s.getAttribute('data-section'), rank: Number(s.getAttribute('data-rank')), source: s.getAttribute('data-source'), severity: s.getAttribute('data-severity') });
      }
    });
  });
  renderRead();
  // Drop read-state for old editions so storage stays small.
  try {
    for (var k = localStorage.length - 1; k >= 0; k--) {
      var key = localStorage.key(k);
      if (key && key.indexOf('pwn_read_') === 0 && key < 'pwn_read_' + isoDay(new Date(Date.now() - 14 * 864e5))) localStorage.removeItem(key);
    }
  } catch (e) {}

  // ---------------- New since your last visit ----------------
  var seen = store.get('pwn_seen', null);
  if (seen && seen.edition && seen.edition < edition) {
    var known = {};
    (seen.stories || []).forEach(function (id) { known[id] = true; });
    var fresh = 0;
    $$('[data-story]').forEach(function (el) {
      if (!known[el.getAttribute('data-story')]) { el.classList.add('is-new'); if (el.matches('li.story')) fresh++; }
    });
    var banner = $('#new-banner');
    if (banner && fresh) {
      var since = new Date(seen.edition + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
      var gap = Math.round((Date.parse(edition) - Date.parse(seen.edition)) / 864e5);
      banner.textContent = fresh + ' new ' + (fresh === 1 ? 'story' : 'stories') + ' since your visit on ' + since + '.';
      if (gap > 1) {
        var a = document.createElement('a');
        a.href = ($('.edition-nav a[href$="archive/"]') || {}).href || 'archive/';
        a.textContent = 'You missed ' + (gap - 1) + ' brief' + (gap - 1 === 1 ? '' : 's') + ' →';
        banner.appendChild(document.createTextNode(' '));
        banner.appendChild(a);
      }
      banner.hidden = false;
    }
  }
  if (!seen || !seen.edition || seen.edition <= edition) store.set('pwn_seen', { edition: edition, stories: ids });

  // ---------------- Open a story (top 3 links, hash links) ----------------
  function openStory(slug, focus, instant) {
    var li = document.getElementById(slug);
    if (!li || !li.matches('li.story')) return false;
    var det = $('details', li);
    if (!det.open) det.open = true;
    if (instant) li.scrollIntoView({ block: 'start' }); else scrollToEl(li);
    if (focus) $('summary', li).focus({ preventScroll: true });
    setCursor(stories.indexOf(li));
    return true;
  }
  $$('[data-open]').forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      if (openStory(a.getAttribute('data-open'), true)) {
        e.preventDefault();
        history.replaceState(null, '', '#' + a.getAttribute('data-open'));
        track('top3_click', { rank: i + 1 });
      }
    });
  });
  if (location.hash.length > 1) {
    var target = decodeURIComponent(location.hash.slice(1));
    if (document.getElementById(target) && document.getElementById(target).matches('li.story')) {
      requestAnimationFrame(function () { openStory(target, false, true); });
    }
  }

  // ---------------- Keyboard navigation ----------------
  var cursor = -1;
  function visible() { return stories.filter(function (s) { return s.style.display !== 'none'; }); }
  function setCursor(i) {
    stories.forEach(function (s) { s.classList.remove('kb-focus'); });
    cursor = i;
    if (i >= 0 && stories[i]) stories[i].classList.add('kb-focus');
  }
  function move(delta) {
    var list = visible();
    if (!list.length) return;
    var pos = list.indexOf(stories[cursor]);
    pos = pos === -1 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, pos + delta));
    var li = list[pos];
    setCursor(stories.indexOf(li));
    $('summary', li).focus({ preventScroll: true });
    var r = li.getBoundingClientRect();
    var top = parseFloat(getComputedStyle(root).scrollPaddingTop) || 70;
    if (r.top < top || r.bottom > window.innerHeight - 24) scrollToEl(li);
  }
  function current() { return cursor >= 0 ? stories[cursor] : null; }
  document.addEventListener('focusin', function (e) {
    var li = e.target.closest && e.target.closest('li.story');
    if (li) setCursor(stories.indexOf(li));
  });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (!searchBox.hidden) { closeSearch(); e.preventDefault(); }
      return;
    }
    if (typing(e.target) || (keys && keys.open)) return;
    var li;
    switch (e.key) {
      case 'j': move(1); break;
      case 'k': move(-1); break;
      case 'o':
        li = current(); if (li) { var d = $('details', li); d.open = !d.open; if (d.open) scrollToEl(li); }
        break;
      case 'v':
        li = current(); if (li) { var src = $('.source-link', li); if (src) { window.open(src.href, '_blank', 'noopener'); markRead(li.getAttribute('data-story')); } }
        break;
      case 'e':
        var anyClosed = stories.some(function (s) { return !$('details', s).open; });
        stories.forEach(function (s) {
          var d = $('details', s);
          if (d.open !== anyClosed) { bulkOpened.add(d); d.open = anyClosed; }
        });
        break;
      case '/': e.preventDefault(); openSearch(); break;
      case 'd': toggleTheme(); break;
      case '?': openKeys(); break;
      default: return;
    }
  });

  // ---------------- Search ----------------
  var searchBox = $('#search'), searchInput = $('#search-input'), searchBtn = $('#search-btn');
  var searchCount = $('#search-count'), noResults = $('#no-results');
  var used = false;
  function openSearch() {
    searchBox.hidden = false;
    searchBtn.setAttribute('aria-expanded', 'true');
    searchInput.focus();
    searchInput.select();
  }
  function closeSearch() {
    searchInput.value = '';
    filter();
    searchBox.hidden = true;
    searchBtn.setAttribute('aria-expanded', 'false');
    searchBtn.focus({ preventScroll: true });
  }
  function filter() {
    var q = searchInput.value.trim().toLowerCase();
    var shown = 0;
    stories.forEach(function (s) {
      var hit = !q || s.textContent.toLowerCase().indexOf(q) !== -1;
      s.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    $$('section.sec').forEach(function (sec) {
      if (!$('li.story', sec)) { sec.style.display = q ? 'none' : ''; return; }
      sec.style.display = $$('li.story', sec).some(function (s) { return s.style.display !== 'none'; }) ? '' : 'none';
    });
    $$('.top3, .index, .lede').forEach(function (el) { el.style.display = q ? 'none' : ''; });
    searchCount.textContent = q ? shown + ' of ' + stories.length : '';
    noResults.hidden = !q || shown > 0;
    if (q && !used) { used = true; track('search_used'); }
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', function () { if (searchBox.hidden) openSearch(); else closeSearch(); });
    $('#search-close').addEventListener('click', closeSearch);
    searchInput.addEventListener('input', filter);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = visible()[0];
        if (first) { e.preventDefault(); searchInput.blur(); openStory(first.id, true); }
      }
    });
  }

  // ---------------- Source / share clicks ----------------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var li = a.closest('li.story');
    if (li && a.classList.contains('source-link')) {
      markRead(li.getAttribute('data-story'));
      track('story_click', { section: li.getAttribute('data-section'), rank: Number(li.getAttribute('data-rank')), source: li.getAttribute('data-source'), severity: li.getAttribute('data-severity') });
    } else if (a.hasAttribute('data-share')) {
      track('share', { method: a.getAttribute('data-share') });
    } else if (a.hasAttribute('data-track')) {
      track('side_click', { section: a.getAttribute('data-track') });
    }
  });
  $$('.copy-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var canonical = ($('link[rel=canonical]') || {}).href || location.href.split('#')[0];
      var url = canonical.split('#')[0] + '#' + btn.getAttribute('data-slug');
      var label = btn.textContent;
      var ok = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = label; }, 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, function () { window.prompt('Copy this link', url); });
      else window.prompt('Copy this link', url);
      track('share', { method: 'copy' });
    });
  });

  // ---------------- Rail: active section ----------------
  var railLinks = $$('.rail-list a');
  if (railLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    railLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var viewed = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        railLinks.forEach(function (a) { a.classList.remove('active'); });
        var a = byId[en.target.id];
        if (a) a.classList.add('active');
        var key = en.target.getAttribute('data-track-section');
        if (key && !viewed[key]) { viewed[key] = true; track('section_view', { section: key }); }
      });
    }, { rootMargin: '-' + (parseInt(getComputedStyle(root).getPropertyValue('--bar-h'), 10) + 20) + 'px 0px -65% 0px' });
    $$('[data-track-section]').forEach(function (s) { io.observe(s); });
  }

  // ---------------- Videos: play inline, link out without JS ----------------
  $$('[data-video]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var frame = document.createElement('div');
      frame.className = 'video-frame';
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(a.getAttribute('data-video')) + '?autoplay=1&rel=0';
      f.title = a.getAttribute('aria-label') || 'Video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.appendChild(f);
      a.replaceWith(frame);
      track('video_play', { video: a.getAttribute('data-video') });
    });
  });

  // ---------------- Tabs ----------------
  var tabs = $$('.tab');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.classList.toggle('active', on);
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t, false); track('side_tab', { tab: t.textContent }); });
    t.addEventListener('keydown', function (e) {
      var j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); selectTab(tabs[j], true); }
    });
  });

  // ---------------- Quiz ----------------
  var answers = store.get('pwn_quiz', {});
  var score = store.get('pwn_quiz_score', { correct: 0, total: 0, scored: [] });
  var reveal = $('.reveal');
  if (reveal) {
    var qd = reveal.getAttribute('data-quiz-date');
    var right = Number(reveal.getAttribute('data-answer'));
    if (answers[qd] !== undefined) {
      var ok = answers[qd] === right;
      if (score.scored.indexOf(qd) === -1) {
        score.total++; if (ok) score.correct++;
        score.scored = score.scored.concat(qd).slice(-120);
        store.set('pwn_quiz_score', score);
      }
      var res = $('#quiz-result');
      res.textContent = (ok ? 'You got it right.' : 'Not this time.') + ' Score: ' + score.correct + ' of ' + score.total + '.';
      res.hidden = false;
    }
  }
  var quiz = $('.quiz');
  if (quiz) {
    var qdate = quiz.getAttribute('data-quiz-date');
    var opts = $$('.option', quiz);
    var lock = function (idx) {
      opts.forEach(function (o) {
        o.disabled = true;
        var chosen = Number(o.getAttribute('data-index')) === idx;
        o.classList.toggle('chosen', chosen);
        o.setAttribute('aria-pressed', chosen ? 'true' : 'false');
      });
      $('#quiz-locked').hidden = false;
      var streakLine = streakText();
      var parts = [];
      if (score.total) parts.push('Score so far: ' + score.correct + ' of ' + score.total + '.');
      if (streakLine) parts.push(streakLine);
      if (parts.length) { $('#quiz-score').textContent = parts.join(' '); $('#quiz-score').hidden = false; }
    };
    if (answers[qdate] !== undefined) lock(answers[qdate]);
    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        var idx = Number(o.getAttribute('data-index'));
        answers[qdate] = idx;
        var keep = {};
        Object.keys(answers).sort().slice(-30).forEach(function (k) { keep[k] = answers[k]; });
        answers = keep;
        store.set('pwn_quiz', answers);
        lock(idx);
        track('quiz_answer', { edition: qdate });
      });
    });
  }

  // ---------------- Visit streak ----------------
  var today = isoDay(new Date());
  var visits = store.get('pwn_visits', []);
  if (visits.indexOf(today) === -1) { visits = visits.concat(today).slice(-60); store.set('pwn_visits', visits); }
  function streakText() {
    var n = 1;
    for (var i = visits.length - 1; i > 0; i--) {
      if (Math.round((Date.parse(visits[i]) - Date.parse(visits[i - 1])) / 864e5) === 1) n++; else break;
    }
    return n >= 2 ? n + '-day reading streak.' : '';
  }

  // ---------------- Countdown to the next brief ----------------
  var cd = $('#countdown');
  if (cd && cd.getAttribute('data-next')) {
    var next = Date.parse(cd.getAttribute('data-next'));
    var at = new Date(next).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    var tick = function () {
      var ms = next - Date.now();
      if (ms <= 0) { cd.textContent = 'A new brief is out. Refresh to read it.'; return; }
      var h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
      cd.textContent = 'Next brief in ' + (h ? h + 'h ' : '') + m + 'm · ' + at + ' your time.';
    };
    tick();
    setInterval(tick, 30000);
  }

  // ---------------- Print: show everything ----------------
  var openedForPrint = [];
  window.addEventListener('beforeprint', function () {
    stories.forEach(function (s) { var d = $('details', s); if (!d.open) { d.open = true; openedForPrint.push(d); } });
  });
  window.addEventListener('afterprint', function () { openedForPrint.forEach(function (d) { d.open = false; }); openedForPrint = []; });
})();
