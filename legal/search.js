/* ComeGrab Legal Help: in-browser search over the legal texts (BM25 + synonyms + old-to-new section lookup). */
(function (root) {
  'use strict';

  var STOP = new Set(('a an the and or of to in on at for from by with is are was were be been being it its this that these those i me my we our ' +
    'you your he she they them his her their as if then than so do does did can could should would will shall may might not no yes what which who ' +
    'whom how when where why about into over under after before against between during without within have has had also any all some such there ' +
    'here please tell want need get got just very really sir madam hi hello').split(' '));

  function stem(w) {
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 5 && /(ing|ed)$/.test(w)) return w.replace(/(ing|ed)$/, '');
    if (w.length > 4 && /es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokenize(s) {
    var m = String(s).toLowerCase().match(/[a-z0-9]+/g) || [];
    var out = [];
    for (var i = 0; i < m.length; i++) {
      var w = m[i];
      if (STOP.has(w)) continue;
      if (w.length < 2 && !/\d/.test(w)) continue;
      out.push(stem(w));
    }
    return out;
  }

  // everyday phrases -> terms the laws actually use
  var SYNONYMS = [
    [/security deposit|\blandlord\b|\btenant\b|\brent(ed)?\b|\btenancy\b|\bdeposit\b/i, 'breach of contract compensation for loss or damage criminal breach of trust money recovery agreement'],
    [/cheque\s*(bounce|bounced|return|dishonou?r)|bounced cheque|bounce of cheque/i, 'dishonour of cheque insufficiency of funds notice drawer negotiable instruments'],
    [/\b(fir|f\.i\.r|first information report)\b|police complaint|file a complaint with police|register a case/i, 'information in cognizable cases first information report police station'],
    [/zero fir/i, 'information cognizable cases any police station'],
    [/anticipatory bail|pre.?arrest bail/i, 'direction for grant of bail to person apprehending arrest'],
    [/\bbail\b/i, 'bail bailable non-bailable offence bond'],
    [/\barrest(ed)?\b|police (took|picked|detain)/i, 'arrest police officer warrant grounds of arrest rights of arrested person'],
    [/divorce|separation|separate from (my )?(husband|wife)/i, 'divorce dissolution of marriage decree petition ground cruelty desertion mutual consent'],
    [/maintenance|alimony|monthly support/i, 'maintenance wives children parents order allowance'],
    [/dowry|498\s?a|harass(ed|ment)? by (my )?(husband|in-?laws)|in-?laws/i, 'cruelty husband relatives woman dowry death domestic violence'],
    [/domestic violence|beat(s|ing)? (me|my wife)|abus(e|ed|ive) (husband|home)/i, 'domestic violence protection order residence order monetary relief'],
    [/\brti\b|right to information|government information/i, 'right to information public authority application information officer'],
    [/consumer (court|complaint|forum|commission)|defective (product|goods)|refund|deficiency in service|cheated by (shop|company|seller)/i, 'consumer complaint commission defect deficiency in service unfair trade practice refund'],
    [/drunk|drink(ing)? and driv|under the influence|alcohol/i, 'driving by a drunken person or by a person under the influence of drugs alcohol'],
    [/challan|traffic fine|licen[cs]e|accident|hit and run|helmet|speeding|over.?speed/i, 'motor vehicle driving licence penalty offences accident compensation insurance'],
    [/cyber|online (fraud|scam|cheat)|hack(ed|ing)|phishing|morph|obscene|identity theft|upi fraud|otp fraud/i, 'computer related offences cheating by personation identity theft electronic record information technology'],
    [/salary not paid|not paid (my )?salary|fired|terminat(ed|ion)|laid off|lay.?off|retrench|strike|union/i, 'retrenchment lay-off termination industrial dispute worker employer strike trade union'],
    [/contract|agreement|breach|agree to|void agreement/i, 'contract agreement breach compensation damages void voidable consideration'],
    [/right to equality|equal(ity)? before (the )?law|discriminat/i, 'equality before law equal protection of the laws article 14 prohibition of discrimination'],
    [/freedom of speech|free speech|freedom of expression|right to protest|freedom of (movement|religion)/i, 'protection of certain rights regarding freedom of speech and expression article 19'],
    [/right to life|personal liberty|right to privacy|right to live/i, 'protection of life and personal liberty article 21'],
    [/fundamental rights?|constitution(al)? rights?/i, 'fundamental rights equality liberty'],
    [/rights? (of|when) (an )?(arrested|arrest)|protection (against|from) arrest/i, 'protection against arrest and detention article 22 grounds of arrest'],
    [/child abuse|sexual abuse of (a )?child|pocso|molest(ed|ation) (a )?child/i, 'sexual offences against children penetrative sexual assault reporting'],
    [/\brape[ds]?\b/i, 'rape punishment for rape gang rape'],
    [/sexual assault|molest|outrag(e|ing) modesty|sexual harass/i, 'sexual harassment outraging modesty woman assault'],
    [/murder|kill(ed|ing)?|homicide/i, 'murder culpable homicide punishment death imprisonment for life'],
    [/\btheft\b|\bsteal(ing)?\b|\bstolen\b/i, 'theft punishment for theft'],
    [/robbery|snatch(ing|ed)?|dacoity|burglary|house.?breaking/i, 'robbery dacoity snatching house-breaking'],
    [/cheat(ed|ing)?|fraud|scam|duped/i, 'cheating dishonestly inducing delivery of property fraud'],
    [/defam(e|ation)|false (rumou?r|allegation)|insult(ed)? (me )?online/i, 'defamation imputation reputation'],
    [/threat(en|ened|s)?|blackmail|extort/i, 'criminal intimidation threat extortion'],
    [/stalk(ed|ing)?|follow(ed|ing)? me/i, 'stalking woman following contact'],
    [/evidence|screenshot|whatsapp (chat|message)|cctv|electronic record|admissib/i, 'admissibility electronic records evidence document certificate'],
    [/confession|statement to police/i, 'confession police officer admissibility'],
    [/maintenance of (parents|senior)|senior citizen/i, 'maintenance parents senior citizens'],
    [/summons?|court notice|warrant/i, 'summons warrant appearance court magistrate'],
    [/compound|settle(ment)? (the )?case/i, 'compounding of offences'],
    [/inherent powers|quash (the )?(fir|case)/i, 'saving of inherent powers of high court quash'],
    [/community service|punishment (for|of) first.?time/i, 'community service punishment'],
    [/mob lynching|lynch/i, 'murder by group of five or more persons caste community'],
    [/hit.?and.?run/i, 'hit and run compensation motor accident'],
    [/marriage (age|registration)|void marriage|second marriage|bigamy/i, 'void marriages bigamy registration of marriage conditions']
  ];

  var LAW_NAMES = { bns: 'bns', bnss: 'bnss', bsa: 'bsa', ipc: 'ipc', crpc: 'crpc', 'cr.p.c': 'crpc', 'cr pc': 'crpc', iea: 'iea' };

  var state = { loaded: false, loading: null, docs: [], inv: {}, avgdl: 1, aliases: {}, byLabel: {}, shards: {} };

  function fetchJson(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function addDoc(shard, label, text) {
    var weight = (shard.id.indexOf('cmp-') === 0) ? 0.55 : 1;
    var tl = tokenize(label);
    var tt = tokenize(text);
    var tf = {}, len = 0, i, t;
    for (i = 0; i < tl.length; i++) { t = tl[i]; tf[t] = (tf[t] || 0) + 3; len += 3; }
    for (i = 0; i < tt.length; i++) { t = tt[i]; tf[t] = (tf[t] || 0) + 1; len += 1; }
    var id = state.docs.length;
    state.docs.push({ id: id, shard: shard.id, short: shard.short, name: shard.name, label: label, text: text, len: len, weight: weight });
    for (t in tf) {
      if (!state.inv[t]) state.inv[t] = [];
      state.inv[t].push([id, tf[t]]);
    }
    var m = label.match(/^(Section|Article) (\d+[A-Z]*):/);
    if (m && label.indexOf('(part') < 0) state.byLabel[shard.id + ':' + m[2].toLowerCase()] = id;
  }

  function load(base, onProgress) {
    if (state.loaded) return Promise.resolve();
    if (state.loading) return state.loading;
    base = base || 'data/';
    state.loading = fetchJson(base + 'manifest.json').then(function (manifest) {
      var done = 0;
      return Promise.all(manifest.map(function (m) {
        return fetchJson(base + m.id + '.json').then(function (s) {
          done++;
          if (onProgress) onProgress(done, manifest.length);
          return s;
        });
      }));
    }).then(function (shards) {
      shards.forEach(function (s) {
        state.shards[s.id] = s;
        s.chunks.forEach(function (c) { addDoc(s, c[0], c[1]); });
      });
      var total = 0;
      state.docs.forEach(function (d) { total += d.len; });
      state.avgdl = total / Math.max(1, state.docs.length);
      return fetchJson(base + 'aliases.json').catch(function () { return {}; });
    }).then(function (al) {
      state.aliases = al || {};
      state.loaded = true;
    }).catch(function (e) {
      state.loading = null;
      throw e;
    });
    return state.loading;
  }

  // find sections the user named directly: "ipc 302", "section 420 ipc", "498A", "bns 103", "article 21", "crpc 438"
  function directRefs(q) {
    var refs = [], seen = {};
    function push(key, why) { if (key && !seen[key]) { seen[key] = 1; refs.push({ key: key, why: why }); } }
    var s = q.toLowerCase().replace(/cr\.?\s?p\.?\s?c\.?/g, 'crpc').replace(/indian penal code/g, 'ipc')
      .replace(/code of criminal procedure/g, 'crpc').replace(/evidence act/g, 'iea').replace(/bharatiya nyaya sanhita/g, 'bns')
      .replace(/bharatiya nagarik suraksha sanhita/g, 'bnss').replace(/bharatiya sakshya adhiniyam/g, 'bsa');
    var re1 = /(?:section|sec\.?|s\.?|u\/s)?\s*(\d{1,3}[a-z]?)\s*(?:of\s*(?:the\s*)?)?(bnss|bns|bsa|ipc|crpc|iea)\b/g;
    var re2 = /\b(bnss|bns|bsa|ipc|crpc|iea)\s*(?:section|sec\.?|s\.?|u\/s)?\s*[:\-]?\s*(\d{1,3}[a-z]?)\b/g;
    var m;
    function handle(law, num) {
      num = num.replace(/\s/g, '');
      if (law === 'ipc' || law === 'crpc' || law === 'iea') {
        var t = state.aliases[law] && state.aliases[law][num];
        if (t) push(t, { old: law.toUpperCase() + ' ' + num.toUpperCase() });
      } else {
        push(law + ':' + num, null);
      }
    }
    while ((m = re1.exec(s))) handle(m[2], m[1]);
    while ((m = re2.exec(s))) handle(m[1], m[2]);
    var art = /article\s*(\d{1,3}[a-z]?)\b/g;
    while ((m = art.exec(s))) push('constitution:' + m[1].replace(/\s/g, ''), null);
    // famous bare numbers when no law is named (e.g. "498A case", "what is 420")
    if (!refs.length) {
      var bare = /\b(302|304b|307|376|420|498a|406|120b|379)\b/g;
      while ((m = bare.exec(s))) {
        var tt = state.aliases.ipc && state.aliases.ipc[m[1]];
        if (tt) push(tt, { old: 'IPC ' + m[1].toUpperCase() });
      }
    }
    return refs;
  }

  function expandQuery(q) {
    var extra = [];
    for (var i = 0; i < SYNONYMS.length; i++) {
      if (SYNONYMS[i][0].test(q)) extra.push(SYNONYMS[i][1]);
    }
    return q + ' ' + extra.join(' ');
  }

  function bm25(qtokens) {
    var N = state.docs.length, k1 = 1.4, b = 0.75, scores = {};
    var wt = {};
    qtokens.forEach(function (t) { wt[t] = (wt[t] || 0) + 1; });
    Object.keys(wt).forEach(function (t) {
      var post = state.inv[t];
      if (!post) return;
      var idf = Math.log(1 + (N - post.length + 0.5) / (post.length + 0.5));
      for (var i = 0; i < post.length; i++) {
        var d = state.docs[post[i][0]], tf = post[i][1];
        var s = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.len / state.avgdl));
        scores[d.id] = (scores[d.id] || 0) + s * Math.min(wt[t], 2);
      }
    });
    return scores;
  }

  function trim(text, n) {
    if (text.length <= n) return text;
    var cut = text.slice(0, n);
    var p = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
    return (p > n * 0.6 ? cut.slice(0, p + 1) : cut) + ' ...';
  }

  /* returns [{short,name,label,text,old,score}] best first */
  function search(query, k) {
    k = k || 6;
    if (!state.loaded) return [];
    var results = [], used = {};
    var refs = directRefs(query);
    refs.forEach(function (r) {
      var id = state.byLabel[r.key];
      if (id === undefined) return;
      var d = state.docs[id];
      if (used[id]) return;
      used[id] = 1;
      // include continuation parts of the same section
      var parts = [d];
      for (var j = id + 1; j < state.docs.length && state.docs[j].shard === d.shard && state.docs[j].label.indexOf(d.label + ' (part') === 0; j++) parts.push(state.docs[j]);
      results.push({ short: d.short, name: d.name, label: d.label, text: parts.map(function (p) { return p.text; }).join('\n'), old: r.why && r.why.old, score: 1000 });
    });
    var qo = tokenize(query);
    var qe = tokenize(expandQuery(query).slice(query.length));
    var sc = bm25(qo.concat(qo, qe));
    var byScore = function (a, b) { return sc[b] * state.docs[b].weight - sc[a] * state.docs[a].weight; };
    var ids = Object.keys(sc).map(Number).sort(byScore).slice(0, 60);
    // a section whose whole title is made of words from the question (e.g. "Theft") gets a boost
    var qset = {};
    qo.concat(qe).forEach(function (t) { qset[t] = 1; });
    ids.forEach(function (id) {
      var title = state.docs[id].label.replace(/^(Section|Article) \d+[A-Z]*:\s*/, '').replace(/\(part \d+\)/, '');
      var tt = tokenize(title);
      if (tt.length && tt.every(function (t) { return qset[t]; })) sc[id] *= 1.6;
    });
    ids.sort(byScore);
    for (var i = 0; i < ids.length && results.length < k; i++) {
      var d2 = state.docs[ids[i]];
      if (used[d2.id]) continue;
      used[d2.id] = 1;
      results.push({ short: d2.short, name: d2.name, label: d2.label, text: d2.text, old: null, score: sc[d2.id] * d2.weight });
    }
    return results.slice(0, k);
  }

  /* passages to send to the AI: capped for cost */
  function passagesFor(results, maxEach, maxTotal) {
    maxEach = maxEach || 1800; maxTotal = maxTotal || 9000;
    var out = [], total = 0;
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var txt = trim(r.text.replace(/\n{2,}/g, '\n'), maxEach);
      if (total + txt.length > maxTotal) break;
      total += txt.length;
      out.push({ label: r.short + ' ' + r.label + (r.old ? ' (replaces ' + r.old + ')' : ''), text: txt });
    }
    return out;
  }

  root.LegalSearch = { load: load, search: search, passagesFor: passagesFor, trim: trim, tokenize: tokenize, _state: state, isLoaded: function () { return state.loaded; } };
})(typeof window !== 'undefined' ? window : globalThis);
