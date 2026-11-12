/* The lobby display. Written in ES5 with XMLHttpRequest on purpose: the browsers
   built into televisions and signage players are often years old, and this
   page has to run on whatever the organisation already owns.

   Every value from the server is written with textContent, never as HTML.

   Options in the page address:
     ?sound=0     no chime when a number is called
     ?lines=0     hide the Waiting column (a screen that only calls numbers) */
(function () {
  'use strict';

  var parts = window.location.pathname.split('/');
  var token = parts[parts.length - 1] || '';
  var query = window.location.search || '';
  var soundOn = !/[?&]sound=0\b/.test(query);
  var showLines = !/[?&]lines=0\b/.test(query);

  var el = function (id) { return document.getElementById(id); };
  var make = function (tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  var clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  var known = {};          // tickets already shown as called, so a chime plays once
  var firstLoad = true;
  var failures = 0;
  var refreshMs = 5000;
  var audio = null;

  if (!showLines) {
    var linesSection = document.querySelector('.lines');
    if (linesSection) linesSection.style.display = 'none';
  }

  function tick() {
    var d = new Date();
    var h = d.getHours(); var m = d.getMinutes();
    var suffix = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) h = 12;
    el('clock').textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix;
  }

  function chime() {
    if (!soundOn) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio = audio || new Ctx();
      if (audio.state === 'suspended' && audio.resume) audio.resume();
      var now = audio.currentTime;
      [[660, 0], [880, 0.22]].forEach(function (note) {
        var osc = audio.createOscillator(); var gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = note[0];
        gain.gain.setValueAtTime(0.0001, now + note[1]);
        gain.gain.exponentialRampToValueAtTime(0.25, now + note[1] + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note[1] + 0.5);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(now + note[1]); osc.stop(now + note[1] + 0.55);
      });
    } catch (e) { /* a screen that cannot play sound still shows the number */ }
  }

  function quiet(title, text) {
    var box = make('div', 'quiet');
    box.appendChild(make('b', null, title));
    if (text) box.appendChild(make('p', null, text));
    return box;
  }

  function render(data) {
    document.title = 'Now Serving · ' + data.organisation;
    var org = el('org'); clear(org);
    org.appendChild(document.createTextNode(data.organisation));
    org.appendChild(make('small', null, data.branch));

    var serving = el('serving'); clear(serving);
    var fresh = false;
    var seen = {};
    if (!data.serving.length) {
      serving.appendChild(quiet('Please Wait', 'Your number will appear here when it is your turn.'));
    }
    for (var i = 0; i < data.serving.length; i++) {
      var t = data.serving[i];
      var key = t.ticket + '|' + (t.called_at || '');
      seen[key] = true;
      var isNew = !known[key] && t.state === 'called';
      var row = make('div', 'row' + (i === 0 ? ' first' : '') + (isNew && !firstLoad ? ' fresh' : ''));
      var left = make('div');
      left.appendChild(make('div', 'no', t.ticket));
      left.appendChild(make('div', 'svc', t.service));
      var right = make('div', 'to');
      right.appendChild(make('span', null, t.counter ? 'Go To' : (t.state === 'called' ? 'Called' : 'Being Served')));
      var where = t.counter || t.service;
      right.appendChild(make('b', where.length > 12 ? 'long' : null, where));
      row.appendChild(left); row.appendChild(right);
      serving.appendChild(row);
      if (isNew && !firstLoad) fresh = true;
    }
    known = seen;
    if (fresh) chime();

    if (showLines) {
      var lines = el('lines'); clear(lines);
      if (!data.lines.length) lines.appendChild(quiet('No Lines Open', ''));
      for (var j = 0; j < data.lines.length; j++) {
        var line = data.lines[j];
        var card = make('div', 'line');
        var top = make('div', 'top');
        top.appendChild(make('div', 'name', line.service));
        top.appendChild(make('div', 'count', line.waiting === 0 ? 'No wait' : line.waiting + ' waiting'));
        card.appendChild(top);
        if (line.next.length) card.appendChild(make('div', 'next', 'Next: ' + line.next.join(' · ')));
        lines.appendChild(card);
      }
    }
    firstLoad = false;
  }

  function status(ok, text) {
    el('dot').className = 'dot' + (ok ? '' : ' off');
    el('status').textContent = text;
  }

  function notSetUp() {
    clear(el('serving'));
    el('serving').appendChild(quiet('This Screen Is Not Set Up', 'Its link has been switched off or is incomplete. Ask your manager for a new link from Lyne Admin.'));
    var lines = el('lines'); if (lines) clear(lines);
    status(false, 'Not connected');
  }

  function load() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/display/' + encodeURIComponent(token), true);
    xhr.timeout = 8000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var next = refreshMs;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          failures = 0;
          if (data.refresh_seconds) refreshMs = Math.max(3, Math.min(60, data.refresh_seconds)) * 1000;
          render(data);
          status(true, 'Live');
        } catch (e) { failures++; }
      } else if (xhr.status === 404) {
        notSetUp();
        next = 60000;
      } else {
        failures++;
        // Keep the last numbers on screen; say so only once it has really gone.
        if (failures >= 3) status(false, 'Reconnecting…');
        next = Math.min(30000, refreshMs * Math.max(1, failures));
      }
      window.setTimeout(load, next);
    };
    xhr.send();
  }

  tick(); window.setInterval(tick, 10000);
  // A television left on for a week should pick up a new version of this page.
  window.setTimeout(function () { window.location.reload(); }, 6 * 60 * 60 * 1000);
  load();
}());
