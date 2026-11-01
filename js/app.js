/* An Advent of Christmas Curiosities
   Plain JavaScript, no dependencies. See CLAUDE.md for the overall design. */
(function () {
  'use strict';

  var TOTAL_DAYS = 24;
  var STORAGE_PREFIX = 'victorian-advent';
  var TWELFTH_NIGHT = 6; // doors stay open through 6 January

  var params = new URLSearchParams(window.location.search);
  var PREVIEW = params.get('preview') === '1';
  var DATE_OVERRIDE = parseDateParam(params.get('date'));
  var TEST_MODE = PREVIEW || DATE_OVERRIDE !== null;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var ORDINALS = [
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
    'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
    'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
    'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth'
  ];
  var TONES = ['red', 'green', 'wine'];
  var VERDICTS_RIGHT = ['Quite right!', 'Splendid. Correct.', 'Bravo! Just so.', 'Capital! Correct.'];
  var VERDICTS_WRONG = ['Alas, not quite.', 'Not so, I fear.', 'A near miss, alas.', 'Regrettably not.'];

  var els = {};
  var questions = new Map();
  var state = null;
  var storageKey = '';
  var activeDay = null;
  var toastTimer = null;

  /* ---------- Dates ---------- */

  function parseDateParam(value) {
    if (!value) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function now() {
    return DATE_OVERRIDE ? new Date(DATE_OVERRIDE.getTime()) : new Date();
  }

  // The season runs Dec–6 Jan, so early-January visits belong to the previous year's calendar.
  function seasonYear(date) {
    return date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
  }

  function isUnlocked(day, date) {
    if (PREVIEW) return true;
    var month = date.getMonth();
    if (month === 11) return date.getDate() >= day;
    if (month === 0) return date.getDate() <= TWELFTH_NIGHT;
    return false;
  }

  function todayDoor(date) {
    return date.getMonth() === 11 && date.getDate() <= TOTAL_DAYS ? date.getDate() : null;
  }

  function daysUntilAdvent(date) {
    var start = new Date(date.getFullYear(), 11, 1);
    var today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((start - today) / 86400000);
  }

  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Storage ---------- */

  function emptyState() { return { v: 1, opened: [], answers: {} }; }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (!raw) return emptyState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyState();
      return {
        v: 1,
        opened: Array.isArray(parsed.opened) ? parsed.opened : [],
        answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {}
      };
    } catch (e) {
      return emptyState();
    }
  }

  function saveState() {
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
  }

  function getPref(name, fallback) {
    try { var v = window.localStorage.getItem(STORAGE_PREFIX + ':' + name); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }

  function setPref(name, value) {
    try { window.localStorage.setItem(STORAGE_PREFIX + ':' + name, value); } catch (e) { /* ignore */ }
  }

  function isOpened(day) { return state.opened.indexOf(day) !== -1; }
  function answerFor(day) { return state.answers[String(day)] || null; }

  /* ---------- Questions ---------- */

  function loadQuestions() {
    return fetch('questions.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = Array.isArray(data) ? data : data.questions;
        if (!Array.isArray(list)) throw new Error('questions.json must contain a "questions" array');
        list.forEach(function (q) {
          if (!q || !Number.isInteger(q.day) || q.day < 1 || q.day > TOTAL_DAYS ||
              typeof q.question !== 'string' || !Array.isArray(q.options) ||
              !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
            console.warn('Skipping malformed question entry', q);
            return;
          }
          questions.set(q.day, q);
        });
      });
  }

  /* ---------- Rendering: doors ---------- */

  function svgUse(id, className) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildDoors() {
    var frag = document.createDocumentFragment();
    for (var day = 1; day <= TOTAL_DAYS; day++) {
      var li = el('li', 'door-cell');
      var btn = el('button', 'door');
      btn.type = 'button';
      btn.dataset.day = String(day);
      btn.dataset.tone = TONES[(day * 7) % TONES.length];

      var inside = el('span', 'door-inside');
      var panel = el('span', 'door-panel');
      var face = el('span', 'door-face');
      ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
        face.appendChild(svgUse('corner', 'door-corner door-corner--' + pos));
      });
      face.appendChild(el('span', 'door-number', String(day)));
      face.appendChild(el('span', 'door-note'));
      panel.appendChild(face);
      panel.appendChild(el('span', 'door-back'));

      btn.appendChild(inside);
      btn.appendChild(panel);
      li.appendChild(btn);
      frag.appendChild(li);
    }
    els.doors.textContent = '';
    els.doors.appendChild(frag);
  }

  function doorButton(day) {
    return els.doors.querySelector('.door[data-day="' + day + '"]');
  }

  function artFallback(day) {
    var wrap = el('span', 'art-fallback');
    wrap.appendChild(svgUse('star'));
    if (TEST_MODE) {
      var q = questions.get(day);
      wrap.appendChild(el('span', 'art-slot-label', q && q.image ? 'missing: ' + q.image : 'image slot · day ' + day));
    }
    return wrap;
  }

  // Art is only loaded once a door has been opened, so nothing is fetched or spoiled early.
  function fillDoorArt(btn, day) {
    var inside = btn.querySelector('.door-inside');
    if (inside.dataset.filled === '1') return;
    inside.dataset.filled = '1';
    var q = questions.get(day);
    if (q && q.image) {
      var img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        inside.textContent = '';
        inside.appendChild(artFallback(day));
      }, { once: true });
      img.src = q.image;
      inside.appendChild(img);
    } else {
      inside.appendChild(artFallback(day));
    }
  }

  function updateDoor(day, date) {
    var btn = doorButton(day);
    if (!btn) return;
    var unlocked = isUnlocked(day, date);
    var opened = unlocked && isOpened(day);
    var answer = answerFor(day);
    var isToday = todayDoor(date) === day;

    btn.classList.toggle('is-locked', !unlocked);
    btn.classList.toggle('is-open', opened);
    btn.classList.toggle('is-today', isToday && unlocked);
    btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');

    var note = btn.querySelector('.door-note');
    note.textContent = '';
    if (!unlocked) note.appendChild(svgUse('keyhole'));
    else if (isToday && !opened) note.textContent = 'Today';

    var oldSeal = btn.querySelector('.seal');
    if (oldSeal) oldSeal.remove();
    if (opened && answer) {
      var seal = el('span', answer.correct ? 'seal' : 'seal seal--wrong', answer.correct ? '✓' : '✕');
      seal.setAttribute('aria-hidden', 'true');
      btn.querySelector('.door-inside').appendChild(seal);
    }
    if (opened) fillDoorArt(btn, day);

    var label = 'December ' + day;
    if (!unlocked) label += ', locked';
    else if (answer) label += answer.correct ? ', answered correctly' : ', answered incorrectly';
    else if (opened) label += ', opened, not yet answered';
    else label += isToday ? ', today’s door, ready to open' : ', ready to open';
    btn.setAttribute('aria-label', label);
  }

  function updateAllDoors() {
    var date = now();
    for (var day = 1; day <= TOTAL_DAYS; day++) updateDoor(day, date);
  }

  /* ---------- Rendering: header ---------- */

  function updateStatus() {
    var date = now();
    var month = date.getMonth();
    var d = date.getDate();
    var text;

    if (PREVIEW) {
      text = 'Preview: all four-and-twenty doors stand unlocked.';
    } else if (month === 11 && d < TOTAL_DAYS) {
      text = 'Today is the ' + ORDINALS[d - 1] + ' of December. Door ' + d + ' awaits.';
    } else if (month === 11 && d === TOTAL_DAYS) {
      text = 'Christmas Eve. The final door is open.';
    } else if (month === 11 || (month === 0 && d <= TWELFTH_NIGHT)) {
      text = 'A merry Christmas! Every door stays open until Twelfth Night.';
    } else {
      var n = daysUntilAdvent(date);
      text = 'The first door opens on the first of December, ' + n + (n === 1 ? ' day' : ' days') + ' hence.';
    }
    els.status.textContent = text;
    els.seasonYear.textContent = String(seasonYear(date));
  }

  function updateScore() {
    var answered = 0;
    var correct = 0;
    Object.keys(state.answers).forEach(function (key) {
      if (!questions.has(Number(key))) return;
      answered++;
      if (state.answers[key].correct) correct++;
    });
    els.scoreCorrect.textContent = String(correct);
    els.scoreAnswered.textContent = String(answered);
    els.scoreProgress.textContent = String(answered);
  }

  /* ---------- Dialog ---------- */

  function openDialog(day) {
    var q = questions.get(day);
    if (!q) {
      toast('This door’s curiosity is still being written.');
      return;
    }
    activeDay = day;
    els.qEyebrow.textContent = 'The ' + capitalise(ORDINALS[day - 1]) + ' of December';
    els.qText.textContent = q.question;

    if (q.image) {
      els.qImg.onerror = function () { els.qArt.hidden = true; };
      els.qImg.src = q.image;
      els.qImg.alt = q.imageAlt || '';
      els.qCredit.textContent = q.imageCredit || '';
      els.qCredit.hidden = !q.imageCredit;
      els.qArt.hidden = false;
    } else {
      els.qImg.removeAttribute('src');
      els.qArt.hidden = true;
    }

    els.qOptions.textContent = '';
    q.options.forEach(function (text, i) {
      var li = el('li');
      var btn = el('button', 'option');
      btn.type = 'button';
      btn.dataset.index = String(i);
      btn.appendChild(el('span', 'option-letter', String.fromCharCode(65 + i)));
      btn.appendChild(el('span', 'option-text', text));
      li.appendChild(btn);
      els.qOptions.appendChild(li);
    });

    var answer = answerFor(day);
    if (answer) showResult(q, answer, false);
    else els.qFeedback.hidden = true;

    if (!els.dialog.open) els.dialog.showModal();
    els.dialog.scrollTop = 0;
    var first = answer ? els.dialogDone : els.qOptions.querySelector('.option');
    if (first) first.focus({ preventScroll: true });
  }

  function showResult(q, answer, moveFocus) {
    var buttons = els.qOptions.querySelectorAll('.option');
    buttons.forEach(function (btn, i) {
      btn.disabled = true;
      if (i === q.answer) {
        btn.classList.add('is-correct');
        btn.appendChild(el('span', 'option-mark', 'correct'));
      } else if (i === answer.choice) {
        btn.classList.add('is-wrong');
        btn.appendChild(el('span', 'option-mark', 'your answer'));
      } else {
        btn.classList.add('is-muted');
      }
    });
    var list = answer.correct ? VERDICTS_RIGHT : VERDICTS_WRONG;
    els.qVerdict.textContent = list[q.day % list.length];
    els.qVerdict.className = 'verdict ' + (answer.correct ? 'is-correct' : 'is-wrong');
    els.qExplanation.textContent = q.explanation || '';
    els.qFeedback.hidden = false;
    if (moveFocus) {
      els.qVerdict.focus({ preventScroll: true });
      els.qFeedback.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function chooseOption(index) {
    var day = activeDay;
    var q = questions.get(day);
    if (!q || answerFor(day)) return;
    var answer = { choice: index, correct: index === q.answer };
    state.answers[String(day)] = answer;
    if (!isOpened(day)) state.opened.push(day);
    saveState();
    showResult(q, answer, true);
    updateScore();
    updateDoor(day, now());
  }

  function closeDialog() {
    if (els.dialog.open) els.dialog.close();
  }

  /* ---------- Interaction ---------- */

  function onDoorClick(event) {
    var btn = event.target.closest('.door');
    if (!btn) return;
    var day = Number(btn.dataset.day);
    var date = now();

    if (!isUnlocked(day, date)) {
      var month = date.getMonth();
      if (month === 11) toast('Patience. This door opens on the ' + ORDINALS[day - 1] + ' of December.');
      else toast('The calendar opens on the first of December. This is door ' + day + '.');
      return;
    }

    if (isOpened(day)) {
      openDialog(day);
      return;
    }

    state.opened.push(day);
    saveState();
    updateDoor(day, date);
    window.setTimeout(function () { openDialog(day); }, reduceMotion.matches ? 0 : 650);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { els.toast.classList.remove('is-visible'); }, 3200);
  }

  function resetAnswers() {
    var msg = TEST_MODE ? 'Clear your preview answers?' : 'Clear your answers and score for this season?';
    if (!window.confirm(msg)) return;
    state = emptyState();
    saveState();
    buildDoors();
    updateAllDoors();
    updateScore();
    toast('The calendar is shut up again, as good as new.');
  }

  // Re-evaluate locks just after local midnight so an open tab rolls over to the next door.
  function scheduleMidnight() {
    if (DATE_OVERRIDE) return;
    var d = new Date();
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5);
    window.setTimeout(function () {
      var key = buildStorageKey();
      if (key !== storageKey) { storageKey = key; state = loadState(); }
      updateStatus();
      updateAllDoors();
      updateScore();
      scheduleMidnight();
    }, next - d);
  }

  function buildStorageKey() {
    return STORAGE_PREFIX + ':' + seasonYear(now()) + (TEST_MODE ? ':preview' : '');
  }

  /* ---------- Snow ---------- */

  function Snow(canvas) {
    var ctx = canvas.getContext('2d');
    var flakes = [];
    var width = 0;
    var height = 0;
    var raf = 0;
    var last = 0;
    var running = false;

    function makeFlake(randomY) {
      var r = 0.6 + Math.pow(Math.random(), 2) * 2.2;
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -5,
        r: r,
        vy: 14 + r * 12,                  // px per second
        sway: 6 + Math.random() * 14,
        freq: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.45
      };
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.round(Math.min(110, (width * height) / 14000));
      while (flakes.length < target) flakes.push(makeFlake(true));
      flakes.length = target;
    }

    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      var secs = t / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fffaf0';
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.vy * dt;
        var x = f.x + Math.sin(secs * f.freq + f.phase) * f.sway;
        if (f.y - f.r > height) { flakes[i] = makeFlake(false); continue; }
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      canvas.hidden = false;
      resize();
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
      canvas.hidden = true;
    }

    window.addEventListener('resize', function () { if (running) resize(); });

    return { start: start, stop: stop, isRunning: function () { return running; } };
  }

  function setupSnow() {
    var snow = Snow(els.snow);
    var enabled = getPref('snow', reduceMotion.matches ? 'off' : 'on') === 'on';

    function apply() {
      if (enabled && !document.hidden) snow.start(); else snow.stop();
      els.snowToggle.textContent = 'Snow: ' + (enabled ? 'on' : 'off');
      els.snowToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    els.snowToggle.addEventListener('click', function () {
      enabled = !enabled;
      setPref('snow', enabled ? 'on' : 'off');
      apply();
    });
    document.addEventListener('visibilitychange', apply);
    apply();
  }

  /* ---------- Boot ---------- */

  function cacheElements() {
    var ids = {
      doors: 'doors', status: 'status', seasonYear: 'season-year', loadError: 'load-error',
      scoreCorrect: 'score-correct', scoreAnswered: 'score-answered', scoreProgress: 'score-progress',
      snow: 'snow', snowToggle: 'snow-toggle', reset: 'reset', toast: 'toast', previewBanner: 'preview-banner',
      dialog: 'dialog', dialogClose: 'dialog-close', dialogDone: 'dialog-done',
      qEyebrow: 'q-eyebrow', qArt: 'q-art', qImg: 'q-img', qCredit: 'q-credit', qText: 'q-text',
      qOptions: 'q-options', qFeedback: 'q-feedback', qVerdict: 'q-verdict', qExplanation: 'q-explanation'
    };
    Object.keys(ids).forEach(function (k) { els[k] = document.getElementById(ids[k]); });
  }

  function bindEvents() {
    els.doors.addEventListener('click', onDoorClick);
    els.qOptions.addEventListener('click', function (e) {
      var btn = e.target.closest('.option');
      if (btn && !btn.disabled) chooseOption(Number(btn.dataset.index));
    });
    els.dialogClose.addEventListener('click', closeDialog);
    els.dialogDone.addEventListener('click', closeDialog);
    els.dialog.addEventListener('click', function (e) {
      if (e.target === els.dialog) closeDialog(); // click on the backdrop
    });
    els.dialog.addEventListener('close', function () {
      var btn = activeDay && doorButton(activeDay);
      activeDay = null;
      if (btn) btn.focus({ preventScroll: true });
    });
    els.reset.addEventListener('click', resetAnswers);
  }

  function init() {
    cacheElements();
    if (PREVIEW) els.previewBanner.hidden = false;

    storageKey = buildStorageKey();
    state = loadState();

    bindEvents();
    setupSnow();
    updateStatus();
    buildDoors();
    updateAllDoors();

    loadQuestions()
      .then(function () {
        // Re-render so art and labels reflect the loaded data.
        buildDoors();
        updateAllDoors();
        updateScore();
        scheduleMidnight();
      })
      .catch(function (err) {
        console.error(err);
        els.loadError.hidden = false;
        els.loadError.textContent = window.location.protocol === 'file:'
          ? 'The questions could not be loaded from a file:// address. Serve the folder with a local web server (see CLAUDE.md).'
          : 'The questions could not be loaded. Please refresh the page.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
