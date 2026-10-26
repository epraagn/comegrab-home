/* ComeGrab Legal Help chat page. Nothing the visitor types is stored by this page. */
(function () {
  'use strict';
  var C = window.LEGAL_CONFIG || {};
  var S = window.LegalSearch;
  var $ = function (id) { return document.getElementById(id); };
  var msgsEl = $('msgs'), qEl = $('q'), sendEl = $('send'), statusEl = $('status'), leftEl = $('left'), personEl = $('person'), startersEl = $('starters');
  var thread = [];      // {role:'user'|'assistant', content}
  var busy = false;

  var URGENT = /\b(arrest(ed)?|kidnap|abduct|threat(en|ened|s)?|beat(en|ing)?|assault|rape[d]?|molest|violence|abus(e|ed|ive)|suicid|kill me|being followed|stalk|blackmail|acid|trafficking|danger|emergency|hurt me|harass)/i;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderText(text) {
    var lines = esc(text).split('\n'), html = '', inList = false;
    lines.forEach(function (l) {
      l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      var m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + m[1] + '</li>'; }
      else { if (inList) { html += '</ul>'; inList = false; } if (l.trim()) html += (/^\s*(<strong>)?Recommendation:/i.test(l) ? '<p class="rec">' : '<p>') + l + '</p>'; }
    });
    if (inList) html += '</ul>';
    return html;
  }

  function scrollDown() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function addMsg(role, html, plain) {
    var row = document.createElement('div');
    row.className = 'msg ' + role;
    var who = document.createElement('div');
    who.className = 'who';
    who.textContent = role === 'user' ? 'You' : 'ComeGrab Legal';
    row.appendChild(who);
    var b = document.createElement('div');
    b.className = 'bubble';
    if (plain) b.textContent = plain; else b.innerHTML = html;
    row.appendChild(b);
    msgsEl.appendChild(row);
    scrollDown();
    return row;
  }

  function summary() {
    var firstQ = '', lastQ = '', lastA = '';
    thread.forEach(function (m) {
      if (m.role === 'user') { if (!firstQ) firstQ = m.content; lastQ = m.content; }
      else lastA = m.content;
    });
    var t = 'Hello, I used the Legal help chat on comegrab.in and would like to talk to a person.\n\nMy question: ' + (firstQ || '(not asked yet)').slice(0, 400);
    if (lastQ && lastQ !== firstQ) t += '\nLatest question: ' + lastQ.slice(0, 300);
    if (lastA) t += '\n\nThe assistant said: ' + lastA.replace(/\[\[HUMAN\]\]/g, '').replace(/\s+/g, ' ').slice(0, 350);
    return t;
  }
  function waLink() { return 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(summary()); }
  function mailLink() { return 'mailto:' + C.email + '?subject=' + encodeURIComponent('Legal help enquiry') + '&body=' + encodeURIComponent(summary()); }

  function handoffBlock(lead) {
    var d = document.createElement('div');
    d.className = 'handoff';
    d.innerHTML = '<p>' + esc(lead || 'Want a person to look at this?') + '</p>' +
      '<div class="cta-row"><a class="btn small" target="_blank" rel="noopener" href="' + waLink() + '">Talk on WhatsApp</a>' +
      '<a class="btn outline small" href="' + mailLink() + '">Send by email</a></div>' +
      '<p class="fine">Your question and a short summary of this chat will be filled in for you to send.</p>';
    return d;
  }

  function updateLeft(n) {
    if (typeof n === 'number') {
      leftEl.textContent = n + (n === 1 ? ' free question' : ' free questions') + ' left today';
    }
  }

  function setBusy(on, text) {
    busy = on;
    sendEl.disabled = on;
    statusEl.textContent = text || '';
  }

  function urgentNotice() {
    addMsg('bot', '<p><strong>If you or someone else is in danger, call 112 now.</strong> Women helpline: 181. Child helpline: 1098. Cyber fraud: 1930.</p>');
  }

  function sectionCards(results, intro) {
    var html = '<p>' + esc(intro) + '</p>';
    results.slice(0, 3).forEach(function (r) {
      html += '<details class="sec"><summary>' + esc(r.short + ' ' + r.label) + (r.old ? ' <em>(replaces ' + esc(r.old) + ')</em>' : '') + '</summary><pre>' + esc(S.trim(r.text, 1600)) + '</pre></details>';
    });
    return html;
  }

  function sourcesLine(passages) {
    if (!passages.length) return null;
    var d = document.createElement('p');
    d.className = 'sources';
    d.textContent = (DEBUG ? 'Search words: ' + (lastKeywords || '(none)') + '. ' : '') + 'Looked at: ' + passages.slice(0, 4).map(function (p) { return p.label.replace(/\s*\(replaces[^)]*\)/, ''); }).join(' | ');
    return d;
  }

  // one search per legal angle, then merge: best result of each angle first, no duplicates, at most 8 sections
  function multiSearch(question, queries) {
    if (!queries.length) return S.search(question, 6);
    var lists = [S.search(question, 3)];
    queries.forEach(function (q) { lists.push(S.search(question + ' ' + q, 4)); });
    var seen = {}, out = [];
    for (var i = 0; i < 4 && out.length < 8; i++) {
      for (var j = 0; j < lists.length && out.length < 8; j++) {
        var r = lists[j][i];
        if (!r) continue;
        var key = r.short + '|' + r.label;
        if (seen[key]) continue;
        seen[key] = 1; out.push(r);
      }
    }
    return out;
  }

  var lastKeywords = '';
  var DEBUG = typeof location !== 'undefined' && /[?&]debug/.test(location.search);

  function ask(question) {
    question = question.replace(/\s+/g, ' ').trim();
    if (!question || busy) return;
    if (question.length > 600) question = question.slice(0, 600);
    addMsg('user', '', question);
    qEl.value = '';
    startersEl.hidden = true;
    var history = thread.slice(-6).map(function (m) { return { role: m.role, content: m.content.slice(0, 1200) }; });
    thread.push({ role: 'user', content: question });
    if (URGENT.test(question)) urgentNotice();
    setBusy(true, 'Looking through the legal texts...');
    var typing = addMsg('bot', '<span class="dots" aria-label="Typing"><i></i><i></i><i></i></span>');

    S.load('data/').then(function () {
      if (!C.api) return { queries: [] };
      setBusy(true, 'Thinking through the legal angles...');
      // Step 1: ask the AI to list the legal angles and search words (falls back silently)
      var ctl0 = new AbortController();
      var t0 = setTimeout(function () { ctl0.abort(); }, 18000);
      return fetch(C.api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl0.signal,
        body: JSON.stringify({ mode: 'rewrite', question: question, history: history })
      }).then(function (r) {
        clearTimeout(t0);
        return r.status === 200 ? r.json() : {};
      }).then(function (d) {
        var qs = d && Array.isArray(d.queries) ? d.queries : (d && typeof d.query === 'string' && d.query ? [d.query] : []);
        return { queries: qs.filter(function (x) { return typeof x === 'string' && x; }).slice(0, 5).map(function (x) { return x.slice(0, 260); }) };
      }).catch(function () { clearTimeout(t0); return { queries: [] }; });
    }).then(function (kw) {
      lastKeywords = kw.queries.join(' | ');
      var results = multiSearch(question, kw.queries);
      var passages = S.passagesFor(results);
      if (!C.api) { return finish(typing, searchOnly(results), passages, true); }
      setBusy(true, 'Writing your answer (checking trusted websites if needed)...');
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); }, 65000);
      return fetch(C.api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ question: question, history: history, passages: passages })
      }).then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; });
      }).then(function (res) {
        if (res.status === 200 && res.data && res.data.answer) {
          updateLeft(res.data.remaining);
          var ans = res.data.answer, human = /\[\[HUMAN\]\]/.test(ans);
          ans = ans.replace(/\[\[HUMAN\]\]/g, '').trim();
          thread.push({ role: 'assistant', content: ans });
          return finish(typing, { html: renderText(ans), human: human, record: false, sources: res.data.sources }, passages, false);
        }
        if (res.status === 429) {
          updateLeft(0);
          return finish(typing, { html: '<p>You have used your ' + esc(C.freeLimit) + ' free questions for today. You can come back tomorrow, or talk to a person now.</p>', human: true, record: true }, [], false);
        }
        var r2 = searchOnly(results);
        r2.html = '<p>The AI assistant is not available right now, so here are the sections that match your question.</p>' + r2.html;
        r2.human = true;
        return finish(typing, r2, passages, true);
      }).catch(function () {
        clearTimeout(timer);
        var r3 = searchOnly(results);
        r3.html = '<p>The AI assistant is not available right now, so here are the sections that match your question.</p>' + r3.html;
        r3.human = true;
        return finish(typing, r3, passages, true);
      });
    }).catch(function () {
      finish(typing, { html: '<p>I could not load the legal texts. Please refresh the page and try again, or talk to a person.</p>', human: true, record: true }, [], false);
    });
  }

  function searchOnly(results) {
    if (!results.length) {
      return { html: '<p>I could not find a matching section in the texts I have. Try different words, or talk to a person.</p>', human: true, record: true };
    }
    return { html: sectionCards(results, 'These are the sections that look most relevant. This is the text of the law itself, not advice for your situation.'), human: results[0].score < 4, record: true };
  }

  function webSources(list) {
    if (!Array.isArray(list) || !list.length) return null;
    var d = document.createElement('div');
    d.className = 'websrc';
    var h = document.createElement('p');
    h.className = 'websrc-h';
    h.textContent = 'Sources from the web';
    d.appendChild(h);
    var ul = document.createElement('ul');
    var n = 0;
    list.slice(0, 5).forEach(function (x) {
      if (!x || typeof x.url !== 'string' || !/^https?:\/\//i.test(x.url)) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      a.textContent = String(x.title || x.url).slice(0, 140);
      li.appendChild(a);
      ul.appendChild(li); n++;
    });
    if (!n) return null;
    d.appendChild(ul);
    return d;
  }

  function finish(typing, out, passages, plainRecord) {
    typing.remove();
    var row = addMsg('bot', out.html);
    if (out.record) thread.push({ role: 'assistant', content: row.textContent.slice(0, 600) });
    var src = out.record ? null : sourcesLine(passages);
    var ws = out.sources ? webSources(out.sources) : null;
    if (ws) row.querySelector('.bubble').appendChild(ws);
    if (src) row.querySelector('.bubble').appendChild(src);
    if (out.human) row.querySelector('.bubble').appendChild(handoffBlock());
    scrollDown();
    setBusy(false, '');
    qEl.focus();
  }

  // events
  sendEl.addEventListener('click', function () { ask(qEl.value); });
  qEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(qEl.value); }
  });
  qEl.addEventListener('input', function () { qEl.style.height = 'auto'; qEl.style.height = Math.min(qEl.scrollHeight, 150) + 'px'; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-starter]'), function (b) {
    b.addEventListener('click', function () { ask(b.getAttribute('data-starter')); });
  });
  personEl.addEventListener('click', function (e) {
    e.preventDefault();
    window.open(waLink(), '_blank', 'noopener');
  });
  $('person-mail').addEventListener('click', function (e) { e.currentTarget.href = mailLink(); });

  // warm the index in the background once the page is idle
  var warm = function () { S.load('data/').catch(function () {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 1500);

  if (C.api) leftEl.textContent = C.freeLimit + ' free questions a day';
  else leftEl.textContent = 'Search mode';
  addMsg('bot', '<p>Hello. Ask me a question about Indian law in your own words. For example: <em>What can I do if a cheque I received bounces?</em></p><p>I give general information from the law, not legal advice. Please do not type names, phone numbers or other personal details.</p>');
})();
