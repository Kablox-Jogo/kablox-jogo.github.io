/* Kablox — telas de menu: tela inicial, modos, desafios, coleção, estatísticas e ajuda.
 * Usa a interface window.GB exposta por js/app.js.
 */
(function () {
  'use strict';
  var G = window.GB, P = G.Progress, fmt = G.fmt, T = window.MZI18n.t;
  function $(s) { return document.querySelector(s); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(id, size) { var s = size || 22; return '<svg width="' + s + '" height="' + s + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function btn(label, cls, fn) { var b = h('button', 'btn ' + (cls || ''), label); b.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); fn(); }); return b; }
  function bar(cur, target) { var w = h('div', 'mini-bar wide'), f = h('span'); f.style.width = (100 * Math.min(1, cur / target)).toFixed(0) + '%'; w.appendChild(f); return w; }
  function stars(n) { var s = h('span', 'stars'); s.setAttribute('aria-label', T('{n} de 3 estrelas', { n: n })); for (var i = 0; i < 3; i++) s.innerHTML += '<svg width="16" height="16" class="' + (i < n ? 'on' : '') + '" aria-hidden="true"><use href="#i-star"/></svg>'; return s; }
  function section(title, note) {
    var sec = h('section', 'm-sec'), t = h('h3', '', title);
    sec.appendChild(t);
    if (note) sec.appendChild(h('p', 'm-note', note));
    return sec;
  }

  /* ---------------- tela inicial ---------------- */
  function playClassic() { playMode('classic'); }
  /* v1.26 (dono): três modos na tela inicial — JOGAR = Clássico; cartões Zen e Eventos embaixo */
  function playMode(m) {
    if (!G.tutorialDone()) { G.startTutorial('play'); return; }
    if (m === 'event') { G.openEvent(); return; }
    var saved = G.hasSave(m);
    if (saved && m !== 'classic') { G.startGame(m, { resume: true }); return; } // Zen/Semana: continua direto
    G.confirmReplace(m, function () { G.startGame(m); }, function () { G.startGame(m, { resume: true }); });
  }
  function syncModePick() {
    $('#play-mode').textContent = G.hasSave('classic') ? T('Continuar · {m}', { m: T('Clássico') }) : T('Clássico');
    var zg = G.flags.zenNew ? (G.stats.zen && G.stats.zen.garden) || 0 : 0; // v1.26: jardim do Zen
    $('#zen-sub').textContent = G.hasSave('zen') ? T('Continuar') + (zg ? ' · 🌱 ' + Math.min(12, 1 + Math.floor(zg / 12)) : '') : T('No seu ritmo');
    var ev = G.eventNow(), st = G.stats, played = ev && (st.events || {})[ev.id];
    $('#events-ico').textContent = ev ? ev.icon : '🎉';
    $('#events-sub').textContent = ev ? T(ev.name) : T('Desafio da Semana');
    $('#badge-events').hidden = !(ev && !played);
  }
  window.GBHome = { sync: syncModePick };
  syncModePick();
  $('#btn-zen').addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); playMode('zen'); });
  $('#btn-play').addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); playMode('classic'); });
  if ($('#home-next')) $('#home-next').addEventListener('click', function () { G.sound.tap(); var g = P.nextGoal(G.stats); G.show(g && g.kind === 'achievement' ? 'stats' : 'collection'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); G.show(b.getAttribute('data-go')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { G.sound.tap(); G.show('home'); });
  });

  /* ---------------- modos ---------------- */
  function renderModes() { // v1.24 (dono): cartões coloridos, menos texto (regras no "?"), recorde e progresso à vista
    var body = $('#body-modes'); body.innerHTML = '';
    var list = [
      { id: 'classic', icon: 'i-crown', name: T('Clássico'), line: T('Partida livre. Faça o máximo de pontos.'), rules: P.MODES.classic.rules.map(T),
        info: G.bestFor('classic') > 0 ? T('Recorde: {n}', { n: fmt(G.bestFor('classic')) }) : T('Sem recorde ainda') },
      { id: 'zen', icon: 'i-leaf', name: T('Zen'), line: T('Sem fim de partida. Jogue no seu ritmo.'), rules: P.MODES.zen.rules.map(T),
        info: G.bestFor('zen') > 0 ? T('Recorde: {n}', { n: fmt(G.bestFor('zen')) }) : T('Sem recorde ainda') },
      { id: 'weekly', icon: 'i-trophy', name: T('Desafio da Semana'), line: T('Mesmas peças para todos até domingo.'),
        rules: [T('Regras do Clássico, sem desfazer e sem reviver.'), T('No fim, o jogo cria um código com todas as suas jogadas.'), T('Quem cola o código vê os pontos conferidos ✅ no Placar da galera.')],
        info: G.bestFor('weekly') > 0 ? T('Seu melhor da semana: {n}', { n: fmt(G.bestFor('weekly')) }) + ' · ' + T('{n} na galera', { n: G.galera().list.length }) : T('Ainda não jogou esta semana') },
      { id: 'challenge', icon: 'i-flag', name: T('Desafios'), line: T('Fases com objetivo e estrelas.'), rules: P.MODES.challenge.rules.map(T),
        info: T('{a} de {b} desafios concluídos · {s} estrelas', { a: P.doneChallenges(G.stats), b: P.CHALLENGES.length, s: P.stars(G.stats) }) }
    ];
    if (G.eventNow()) list.unshift({ id: 'event', emoji: '🎃', name: T('Semana do Terror'), line: T('Liberte {n} morcegos 🦇 numa partida só.', { n: G.eventNow().goal }),
      rules: [T('Quebre as gaiolas para soltar os morcegos. Elas aparecem bem mais neste desafio.'), T('Prêmio: a conquista Caçador de Morcegos, para sempre.'), T('O evento acaba domingo, 8/11.')],
      info: G.stats.rares && G.stats.rares.pk ? T('Você já é Caçador de Morcegos! Jogue de novo por diversão.') : T('Prêmio ainda não conquistado') });
    list.forEach(function (m) {
      var card = h('article', 'mode-card mc-' + m.id), head = h('div', 'mode-head');
      if (m.emoji) head.appendChild(h('span', 'mode-emoji', m.emoji)); else head.innerHTML = icon(m.icon, 34);
      var tw = h('div'); tw.appendChild(h('h3', '', m.name)); tw.appendChild(h('p', 'm-note', m.line)); head.appendChild(tw);
      card.appendChild(head);
      card.appendChild(h('p', 'mode-best', m.info));
      var det = h('details', 'mode-rules'), sm = h('summary', '', T('Regras')); det.appendChild(sm);
      var ul = h('ul', 'rules'); m.rules.forEach(function (r) { ul.appendChild(h('li', '', r)); }); det.appendChild(ul); card.appendChild(det);
      var row = h('div', 'mode-actions');
      if (m.id === 'challenge') row.appendChild(btn(T('Ver desafios'), 'primary', function () { G.show('challenges'); }));
      else if (m.id === 'event') row.appendChild(btn(T('Jogar'), 'primary', function () { G.openEvent(); }));
      else {
        if (G.hasSave(m.id)) row.appendChild(btn(T('Continuar'), 'primary', function () { G.startGame(m.id, { resume: true }); }));
        row.appendChild(btn(G.hasSave(m.id) ? T('Nova partida') : T('Jogar'), G.hasSave(m.id) ? '' : 'primary', function () {
          if (m.id === 'classic' && !G.tutorialDone()) { G.startTutorial('play'); return; }
          G.confirmReplace(m.id, function () { G.startGame(m.id); }, function () { G.startGame(m.id, { resume: true }); });
        }));
        if (m.id === 'weekly') row.appendChild(btn(T('Placar da galera'), '', function () { G.show('records'); }));
      }
      card.appendChild(row);
      body.appendChild(card);
    });
  }

  /* ---------------- desafios e missões ---------------- */
  function renderChallenges() {
    var body = $('#body-challenges'), st = G.stats, day = G.today(); body.innerHTML = '';
    P.ensureMissions(st, day); G.saveStats();

    var d = P.daily(day), sec = section('📅 ' + T('Desafio do dia'), d.text + ' ' + T('Mesmas peças para todo mundo hoje: compare com seus amigos.'));
    sec.classList.add('hero-daily'); // v1.25.1 (dono): o desafio tem que parecer um botão de jogar, não uma missão
    var info = h('p', 'mode-best', st.daily.day === day && st.daily.played
      ? T(st.daily.played > 1 ? 'Seu melhor hoje: {n} pontos ({k} tentativas)' : 'Seu melhor hoje: {n} pontos ({k} tentativa)', { n: fmt(st.daily.best), k: st.daily.played })
      : T('Você ainda não jogou hoje.'));
    sec.appendChild(info);
    var row = h('div', 'mode-actions');
    if (G.hasSave('daily')) row.appendChild(btn('▶ ' + T('Continuar'), 'primary big', function () { G.startGame('daily', { resume: true }); }));
    row.appendChild(btn('▶ ' + (st.daily.day === day && st.daily.played ? T('Jogar de novo') : T('Jogar')), G.hasSave('daily') ? '' : 'primary big', function () {
      G.confirmReplace('daily', function () { G.startGame('daily'); }, function () { G.startGame('daily', { resume: true }); });
    }));
    sec.appendChild(row);
    body.appendChild(sec);

    var ms = section(T('Missões de hoje'), G.flags.helpers ? T('Acontecem sozinhas enquanto você joga. Cada missão concluída dá +1 ajuda (Martelo, Girar ou Dica). Se você não jogar num dia, nada é perdido.') : T('Acontecem sozinhas enquanto você joga. Se você não jogar num dia, nada é perdido.'));
    ms.classList.add('missions-sec');
    var ul = h('ul', 'mission-list');
    st.missions.forEach(function (m) {
      var def = P.missionDef(m.id), li = h('li', m.done ? 'done' : '');
      var top = h('div', 'mission-top');
      top.innerHTML = m.done ? icon('i-check', 20) : icon('i-star', 18);
      top.appendChild(h('span', '', T(def.text)));
      top.appendChild(h('b', '', m.done ? T('Feito') : (def.stat === 'gameScore' ? fmt(m.cur) + '/' + fmt(def.target) : m.cur + '/' + def.target)));
      if (G.flags.helpers) top.appendChild(h('span', 'mission-prize' + (m.done ? ' got' : ''), m.done ? '✓ ' + T('ajuda') : '+1 ' + T('ajuda')));
      li.appendChild(top); li.appendChild(bar(m.cur, def.target));
      ul.appendChild(li);
    });
    ms.appendChild(ul);
    body.appendChild(ms);

    var cs = section(T('Aventura'), T('Fases em capítulos. Cada fase usa sempre a mesma sequência de peças e já foi vencida pelo nosso robô de testes. Use menos peças para ganhar até 3 estrelas.'));
    if (G.hasSave('challenge')) {
      var saved = G.store.get('gb.save.challenge', null);
      cs.appendChild(btn(T('Continuar: {name}', { name: T(G.challengeDef(saved && saved.chId).name) }), 'primary', function () { G.startGame('challenge', { resume: true }); }));
    }
    body.appendChild(cs);
    // v1.17 — Aventura: os desafios em capítulos (Capítulo 1 = os 10 originais, livres). Capítulos novos abrem
    // quando a fase-chefe do anterior é vencida; dentro deles, as fases abrem em sequência.
    var nextLv = null; // v1.25.1: a próxima fase a jogar ganha destaque e botão "Jogar"
    P.CHAPTERS.forEach(function (ch) { if (!P.chapterOpen(st, ch)) return; ch.levels.forEach(function (id) { if (!nextLv && P.levelOpen(st, id) && !(st.challenges[id] && st.challenges[id].stars)) nextLv = id; }); });
    P.CHAPTERS.forEach(function (ch, ci) {
      var open = P.chapterOpen(st, ch), pr = P.chapterProgress(st, ch);
      var sec = section(T('Capítulo {n}: {name}', { n: ci + 1, name: T(ch.name) }), '');
      sec.classList.add('chapter'); if (!open) sec.classList.add('locked');
      var head = h('div', 'chapter-head');
      head.appendChild(h('small', '', T('{d} de {t} fases', { d: pr.done, t: pr.total }) + ' · ' + pr.stars + '/' + pr.maxStars + ' ★'));
      if (ch.reward) head.appendChild(h('span', 'chapter-reward', (st.chapterRewards || {})[ch.id] ? T('Recompensa recebida: {name}', { name: T(skinNameOf(ch.reward)) }) : T('Recompensa: estilo {name}', { name: T(skinNameOf(ch.reward)) })));
      sec.appendChild(head); sec.appendChild(bar(pr.stars, pr.maxStars));
      if (!open) {
        var prev = P.CHAPTERS[ci - 1];
        sec.appendChild(h('p', 'm-note', T('Bloqueado: vença "{name}" para abrir.', { name: T(G.challengeDef(prev.levels[prev.levels.length - 1]).name) })));
      }
      var list = h('ol', 'ch-list');
      ch.levels.forEach(function (id) {
        var c = G.challengeDef(id), i = P.CHALLENGES.indexOf(c), rec = st.challenges[c.id], li = h('li'), lvOpen = P.levelOpen(st, c.id);
        var b = h('button', 'ch-item' + (rec && rec.stars ? ' done' : '') + (lvOpen ? '' : ' locked') + (c.id === nextLv ? ' next' : ''));
        b.appendChild(h('span', 'ch-num', String(i + 1)));
        var tx = h('span', 'ch-text'), nm = h('strong', '', T(c.name));
        if (c.boss) nm.appendChild(h('span', 'boss-tag', T('CHEFE')));
        tx.appendChild(nm);
        tx.appendChild(h('small', c.goal === 'gems' ? 'gem-tag' : '', P.goalText(c) + ' · ' + T('{n} peças', { n: c.pieces })));
        if (lvOpen) tx.appendChild(stars(rec ? rec.stars : 0));
        b.appendChild(tx);
        if (!lvOpen) b.insertAdjacentHTML('beforeend', icon('i-lock', 18));
        else b.appendChild(h('span', c.id === nextLv ? 'ch-play' : 'ch-go', c.id === nextLv ? '▶ ' + T('Jogar') : (rec && rec.stars ? '↻' : '▶')));
        b.setAttribute('aria-label', (i + 1) + '. ' + T(c.name) + ': ' + P.goalText(c) + '. ' + (!lvOpen ? T('bloqueado') : rec ? T('{n} estrelas', { n: rec.stars }) : T('não concluído')));
        b.addEventListener('click', function () {
          if (!lvOpen) { G.toast(T('Fase bloqueada'), T('Vença a fase anterior para abrir.')); return; }
          G.sound.tap(); G.openChallengeIntro(c.id);
        });
        li.appendChild(b); list.appendChild(li);
      });
      sec.appendChild(list);
      body.appendChild(sec);
    });
  }
  function skinNameOf(id) { var s = G.Skins.LIST.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }

  /* ---------------- coleção ---------------- */
  /* v1.25: álbum de eventos — cada evento que o jogador jogou fica guardado para sempre (selo, blocos vistos, abóboras) */
  var hwSheet = null;
  function drawHwIcon(cv, key) {
    var art = window.MZHalloweenArt; if (!art) return;
    var row = art.keys.indexOf(key), c = art.cell, ctx = cv.getContext('2d');
    function paint() { ctx.clearRect(0, 0, 88, 88); for (var q = 0; q < 4; q++) ctx.drawImage(hwSheet, q * c, row * c, c, c, (q % 2) * 44, Math.floor(q / 2) * 44, 44, 44); }
    if (!hwSheet) { hwSheet = new Image(); hwSheet.src = art.src; }
    if (hwSheet.complete && hwSheet.naturalWidth) paint(); else hwSheet.addEventListener('load', paint);
  }
  function renderEventAlbum(body, st) {
    var evs = (window.MZEvents && window.MZEvents.LIST) || [], now = G.eventNow();
    evs.forEach(function (ev) {
      var mine = (st.events || {})[ev.id], active = now && now.id === ev.id;
      if (!ev.album || (!mine && !active)) return; // evento que você não jogou (e que já acabou) não aparece
      var seen = (mine && mine.seen) || {}, nSeen = ev.album.filter(function (a) { return seen[a[0]]; }).length;
      var sec = section(ev.icon + ' ' + T(ev.name) + ' 2026', active
        ? T('Só no Desafio do evento. Descubra os blocos de Halloween jogando: cada estilo que aparecer na partida entra aqui. Fica guardado para sempre.')
        : T('Evento encerrado. Tudo o que você conquistou fica guardado aqui para sempre.'));
      var sel = h('p', 'm-note ev-badge' + (mine ? ' got' : ''), mine ? '🏅 ' + T(ev.badge) + ' — ' + T('guardado para sempre') : T('Jogue o Desafio do evento para ganhar o {b}.', { b: T(ev.badge) }));
      sec.appendChild(sel);
      var pkTxt = st.rares && st.rares.pk ? T('🏆 Caçador de Morcegos: conquistado!') : T('🏆 Caçador de Morcegos: liberte {n} morcegos numa partida (seu melhor: {b}).', { n: ev.goal, b: (mine && mine.pk) || 0 });
      sec.appendChild(h('p', 'm-note', pkTxt));
      if (ev.nightmare && (active || (mine && mine.nightmare))) sec.appendChild(h('p', 'm-note ev-badge' + (mine && mine.nightmare ? ' got' : ''), mine && mine.nightmare ? '👹 ' + T(ev.nightmare.badge) + ' — ' + T('guardado para sempre') : T('Fase Pesadelo: vença o desafio para liberar e ganhar o {b}.', { b: T(ev.nightmare.badge) })));
      sec.appendChild(h('p', 'm-note', T('Blocos descobertos: {a} de {b}', { a: nSeen, b: ev.album.length })));
      var grid = h('div', 'col-grid gallery');
      ev.album.forEach(function (a) {
        var got = !!seen[a[0]], b = h('div', 'col-item' + (got ? '' : ' locked'));
        b.setAttribute('role', 'img'); b.setAttribute('aria-label', got ? T(a[1]) : T('Bloco ainda não descoberto'));
        var cv = document.createElement('canvas'); cv.width = 88; cv.height = 88; b.appendChild(cv);
        if (got) drawHwIcon(cv, a[0]); else { var cx = cv.getContext('2d'); cx.fillStyle = '#2a2140'; cx.fillRect(0, 0, 88, 88); cx.fillStyle = '#8f7fb0'; cx.font = 'bold 40px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', 44, 46); }
        b.appendChild(h('strong', '', got ? T(a[1]) : '???'));
        grid.appendChild(b);
      });
      sec.appendChild(grid);
      body.appendChild(sec);
    });
  }
  /* v1.26 (dono): Modo Eventos — o que está valendo agora, o que vem por aí e o álbum (nada é apagado) */
  function fmtDay(k) { var p = String(k).split('-'); return p[2] + '/' + p[1]; }
  function renderEvents() {
    var body = $('#body-events'), st = G.stats, day = G.today(), evs = (window.MZEvents && window.MZEvents.LIST) || [], now = G.eventNow(); body.innerHTML = '';
    if (now) { // evento valendo
      var mine = (st.events || {})[now.id], sec = section(now.icon + ' ' + T(now.name), T('Até {d}. Conteúdo só deste evento: não aparece no Clássico nem no Zen.', { d: fmtDay(now.to) }));
      sec.classList.add('hero-daily', 'ev-live');
      if (now.goal) sec.appendChild(h('p', 'mode-best', T('Seu melhor: {b} de {n}', { b: (mine && mine.pk) || 0, n: now.goal })));
      var bt = btn('▶ ' + T('Jogar o evento'), 'primary big', function () { G.openEvent(); }); bt.id = 'btn-event';
      sec.appendChild(bt); body.appendChild(sec);
    }
    var wk = section('🏆 ' + T('Desafio da Semana'), T('Mesmas peças para todos até domingo. No fim, o jogo cria um código para comparar com a galera.'));
    wk.classList.add('ev-week');
    wk.appendChild(h('p', 'mode-best', G.bestFor('weekly') > 0 ? T('Seu melhor da semana: {n}', { n: fmt(G.bestFor('weekly')) }) : T('Ainda não jogou esta semana')));
    var bw = btn('▶ ' + (G.hasSave('weekly') ? T('Continuar') : T('Jogar')), now ? '' : 'primary big', function () { playMode('weekly'); }); bw.id = 'btn-weekly';
    wk.appendChild(bw); body.appendChild(wk);
    var soon = evs.filter(function (e) { return window.MZEvents.stateOf(e, day) === 'future'; });
    if (soon.length) {
      var ss = section(T('Em breve'), '');
      soon.forEach(function (e) {
        var row = h('div', 'ev-soon'), tx = h('span', 'mc-txt');
        row.appendChild(h('span', 'mc-ico', e.icon)); tx.appendChild(h('strong', '', T(e.name))); tx.appendChild(h('small', '', T('Começa em {d}', { d: fmtDay(e.from) })));
        row.appendChild(tx); row.appendChild(h('span', 'ev-lock', '🔒')); ss.appendChild(row);
      });
      body.appendChild(ss);
    }
    var al = h('h3', 'ev-album-title', '📖 ' + T('Álbum de eventos')); body.appendChild(al);
    var before = body.children.length;
    renderEventAlbum(body, st);
    if (body.children.length === before) body.appendChild(h('p', 'm-note ev-empty', T('Os eventos que você jogar ficam guardados aqui para sempre, com tudo o que você conquistou.')));
  }
  function renderCollection() {
    var body = $('#body-collection'), st = G.stats; body.innerHTML = '';
    // v1.18 (pedido do dono): galeria — só para ver. Toda partida começa no Clássico e os blocos mudam sozinhos.
    var sk = section(T('Galeria de blocos'), T('Os estilos que você já liberou. Toda partida começa no Clássico e, em jogadas especiais, os blocos se transformam nestes estilos.'));
    var grid = h('div', 'col-grid gallery'), hidden = 0;
    G.Skins.LIST.forEach(function (s) {
      var open = P.isUnlocked(st, s.id);
      if (!open || (G.Skins.rareIds.indexOf(s.id) !== -1 && !(st.surpriseSeen || {})[s.id])) { hidden++; return; } // só o que já foi liberado
      var b = h('div', 'col-item' + (s.id === 'classic' ? ' selected' : '')); // destaque: o Clássico é o estilo de toda partida
      b.setAttribute('role', 'img');
      var cv = document.createElement('canvas'); cv.width = 88; cv.height = 88; b.appendChild(cv);
      G.drawSkinPreview(cv, s.id);
      var nm = T(s.name);
      b.appendChild(h('strong', '', nm));
      b.appendChild(h('small', '', s.id === 'classic' ? T('Início de toda partida') : T('Liberado')));
      b.setAttribute('aria-label', s.id === 'classic' ? T('{name}, início de toda partida', { name: nm }) : T('{name}, liberado', { name: nm }));
      grid.appendChild(b);
    });
    sk.appendChild(grid);
    if (hidden) sk.appendChild(h('p', 'm-note', T('Mais {n} estilos para liberar jogando — sem compras.', { n: hidden })));
    body.appendChild(sk);

    // v1.26 (dono): Zen novo — jardim e galeria de quadros
    if (G.flags.zenNew) {
    var zs = section('🌿 ' + T('Jardim e quadros do Zen'), T('Cada linha que você limpa no Zen faz o jardim crescer e pinta um quadro. Quando o quadro fica pronto, ele vem para cá.'));
    var zd = st.zen || { garden: 0, art: [] }, gcv = document.createElement('canvas'); gcv.className = 'zen-garden-big'; zs.appendChild(gcv);
    var zp = h('p', 'm-note', T('{n} linhas no Zen · {p} plantas', { n: G.fmt(zd.garden || 0), p: Math.min(12, 1 + Math.floor((zd.garden || 0) / 12)) })); zs.appendChild(zp);
    if ((zd.art || []).length) {
      var ag = h('div', 'art-grid');
      zd.art.forEach(function (a, i) { var ac = document.createElement('canvas'); ac.className = 'art-item'; ac.setAttribute('role', 'img'); ac.setAttribute('aria-label', T('Quadro {n}', { n: zd.art.length - i })); ag.appendChild(ac); });
      zs.appendChild(ag);
    } else zs.appendChild(h('p', 'm-note', T('Nenhum quadro pronto ainda.')));
    body.appendChild(zs);
    requestAnimationFrame(function () { if (!document.contains(gcv)) return; G.drawGarden(gcv, zd.garden || 0); Array.prototype.forEach.call(zs.querySelectorAll('.art-item'), function (ac, i) { G.drawArt(ac, zd.art[i]); }); });

    // v1.26 (dono): blocos lendários — cadeado com o bloco escondido até passar a marca no Clássico
    } // fim do Zen novo
    if (window.MZLegend && G.flags.legends) {
      var lgSec = section('✨ ' + T('Blocos lendários'), T('Liberados para sempre ao passar a marca no Clássico. Aparecem às vezes nas peças — e às vezes com poder: ⚡ limpa linha e coluna · 💎 muitos pontos · 👑 dobra a jogada · 🌈 completa uma linha.'));
      var lg = h('div', 'leg-grid'), lgN = 0;
      window.MZLegend.LIST.forEach(function (l, i) {
        var got = st.legends && st.legends[l.id], it = h('div', 'leg-item' + (got ? '' : ' locked'));
        if (got) { lgN++; var c2 = document.createElement('canvas'); c2.width = c2.height = 128; window.MZLegend.draw(c2.getContext('2d'), l.id, 0, 0, 128, 900 + i * 400, { seed: i }); it.appendChild(c2); it.appendChild(h('strong', '', T(l.name))); it.appendChild(h('small', '', T('Liberado'))); }
        else { it.appendChild(h('div', 'leg-lock', '🔒')); it.appendChild(h('strong', '', '???')); it.appendChild(h('small', '', T('{n} pontos', { n: G.fmt(l.min) }))); }
        lg.appendChild(it);
      });
      lgSec.appendChild(lg); lgSec.appendChild(h('p', 'm-note', T('{a} de {b} liberados', { a: lgN, b: window.MZLegend.LIST.length })));
      body.appendChild(lgSec);
    }

    var th = section(T('Visuais'), T('O visual do jogo muda sozinho em jogadas especiais (combos, várias linhas, tabuleiro limpo, recordes). Só a aparência muda, nunca as regras.'));
    var tl = h('ul', 'theme-list');
    G.THEMES.forEach(function (t, i) {
      var seen = i === 0 || !!st.themesSeen[t.id], li = h('li', seen ? '' : 'locked');
      var sw = h('span', 'swatch');
      sw.style.background = 'linear-gradient(135deg,' + t.bg[0] + ',' + t.bg[1] + ')';
      t.palette.slice(0, 4).forEach(function (c) { var dot = h('i'); dot.style.background = c; sw.appendChild(dot); });
      li.appendChild(sw);
      var tx = h('span', 'ch-text'); tx.appendChild(h('strong', '', T(t.name)));
      tx.appendChild(h('small', '', i === 0 ? T('Visual inicial') : seen ? T('Descoberto') + ' · ' + T(t.msg) : T('Aparece em jogadas especiais')));
      li.appendChild(tx);
      if (seen) li.insertAdjacentHTML('beforeend', icon('i-check', 20)); else li.insertAdjacentHTML('beforeend', icon('i-lock', 18));
      tl.appendChild(li);
    });
    th.appendChild(tl);
    body.appendChild(th);
  }

  /* ---------------- estatísticas e conquistas ---------------- */
  function renderStats() {
    var body = $('#body-stats'), st = G.stats; body.innerHTML = '';
    var mins = Math.round(st.timeMs / 60000);
    var items = [
      [fmt(st.best.classic), T('Recorde Clássico')], [fmt(st.best.zen), T('Recorde Zen')], [fmt(st.games), T('Partidas')],
      [st.bestCombo ? '×' + st.bestCombo : '—', T('Maior combo')], [fmt(st.lines), T('Linhas limpas')], [fmt(st.clears), T('Tabuleiros limpos')],
      [fmt(st.placed), T('Peças colocadas')],
      [mins < 60 ? T('{n} min', { n: mins }) : T('{n} h', { n: (mins / 60).toLocaleString(window.MZI18n.locale(), { maximumFractionDigits: 1 }) }), T('Tempo jogado (aprox.)')],
      [fmt(P.stars(st)), T('Estrelas')]
    ];
    var sec = section(T('Estatísticas'), T('Ficam só neste aparelho.'));
    var g = h('div', 'stat-grid');
    items.forEach(function (it) { var d = h('div'); d.appendChild(h('strong', '', it[0])); d.appendChild(h('span', '', it[1])); g.appendChild(d); });
    sec.appendChild(g);
    body.appendChild(sec);

    var list = P.achievements(st), done = list.filter(function (a) { return a.done; }).length;
    var ac = section(T('Conquistas'), T('{a} de {b} conquistadas', { a: done, b: list.length }));
    var ul = h('ul', 'ach-list');
    list.sort(function (a, b) { return (b.done - a.done) || (b.cur / b.target - a.cur / a.target); }).forEach(function (a) {
      var li = h('li', a.done ? 'done' : '');
      var top = h('div', 'mission-top');
      top.innerHTML = a.done ? icon('i-check', 20) : icon('i-trophy', 18);
      var tx = h('span', 'ch-text'); tx.appendChild(h('strong', '', a.name)); tx.appendChild(h('small', '', a.desc)); top.appendChild(tx);
      top.appendChild(h('b', '', a.done ? T('Feito') : fmt(a.cur) + '/' + fmt(a.target)));
      li.appendChild(top);
      if (!a.done) li.appendChild(bar(a.cur, a.target));
      ul.appendChild(li);
    });
    ac.appendChild(ul);
    body.appendChild(ac);
  }

  /* ---------------- recordes ---------------- */
  function renderRecords() {
    var body = $('#body-records'), st = G.stats, day = G.today(); body.innerHTML = '';
    var SN = window.MZSeason, lv = SN.levelOf(st.xp || 0), sk = st.streak || {};
    var sec = section(T('Temporada {n}', { n: SN.SEASON }));
    var g = h('div', 'stat-grid');
    [[fmt(st.best.classic), T('Recorde Clássico')], [fmt(st.best.zen), T('Recorde Zen')],
      [st.daily.day === day && st.daily.played ? fmt(st.daily.best) : '—', T('Melhor do dia de hoje')],
      [P.doneChallenges(st) + '/' + P.CHALLENGES.length, T('Desafios concluídos')], [fmt(P.stars(st)), T('Estrelas')],
      [st.bestCombo ? '×' + st.bestCombo : '—', T('Maior combo')],
      [T('Nível {n}', { n: lv.level }), T(lv.title)], [(sk.best || 0) + ' 🔥', T('Maior sequência de dias')]
    ].concat(st.legend && st.legend.classic > 0 ? [[fmt(st.legend.classic), T('Recorde lendário (antes da Temporada 1)')]] : []).forEach(function (it) { var d = h('div'); d.appendChild(h('strong', '', it[0])); d.appendChild(h('span', '', it[1])); g.appendChild(d); });
    sec.appendChild(g);
    body.appendChild(sec);

    // v1.24: Placar da galera do Desafio da Semana
    var gal = section(T('Placar da galera · Desafio da Semana'), T('Só entram pontos conferidos: o jogo refaz a partida de cada código colado.'));
    var gl = G.galera().list;
    if (!gl.length) gal.appendChild(h('p', 'mode-best', T('Ninguém ainda nesta semana. Jogue o Desafio da Semana e mande seu código para a galera.')));
    else {
      var gol = h('ol', 'rec-list galera');
      gl.forEach(function (e, i) {
        var li = h('li', (i === 0 ? 'first' : '') + (e.me ? ' me' : ''));
        li.appendChild(h('span', 'rec-pos', i === 0 ? '👑' : String(i + 1)));
        var tx = h('span', 'ch-text'); var md = SN.medalFor(e.score);
        tx.appendChild(h('strong', '', e.name + (e.me ? ' (' + T('você') + ')' : ' ✅')));
        tx.appendChild(h('small', '', fmt(e.score) + ' ' + T('pontos') + (md ? ' ' + md.icon : '')));
        li.appendChild(tx); gol.appendChild(li);
      });
      gal.appendChild(gol);
    }
    var ga = h('div', 'mode-actions');
    ga.appendChild(btn(T('Colar código de amigo'), 'primary', function () { G.openPasteFriend(); }));
    if (G.bestFor('weekly') > 0) ga.appendChild(btn(T('Mandar meu código'), '', function () { G.shareWeekly(); }));
    ga.appendChild(btn(G.nick() ? T('Apelido: {n}', { n: G.nick() }) : T('Escolher apelido'), '', function () { G.askNick(); }));
    gal.appendChild(ga);
    body.appendChild(gal);

    var top = section(T('Melhores partidas'), T('As 10 maiores pontuações deste aparelho (Clássico e Desafio do dia).'));
    var list = G.records();
    if (!list.length) top.appendChild(h('p', 'mode-best', T('Nenhuma partida terminada ainda. Jogue uma para aparecer aqui.')));
    else {
      var ol = h('ol', 'rec-list');
      list.forEach(function (r, i) {
        var li = h('li', i === 0 ? 'first' : '');
        li.appendChild(h('span', 'rec-pos', String(i + 1)));
        var tx = h('span', 'ch-text');
        var md = SN.medalFor(r.score);
        tx.appendChild(h('strong', '', fmt(r.score) + (md ? ' ' + md.icon : '')));
        var when = '';
        try { var p = String(r.day).split('-'); when = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(window.MZI18n.locale(), { day: 'numeric', month: 'short' }); } catch (e) {}
        tx.appendChild(h('small', '', T(r.mode === 'daily' ? 'Desafio do dia' : 'Clássico') + ' · ' + T('{n} linhas', { n: fmt(r.lines || 0) }) + (when ? ' · ' + when : '')));
        li.appendChild(tx);
        ol.appendChild(li);
      });
      top.appendChild(ol);
    }
    body.appendChild(top);
  }

  /* ---------------- ajuda ---------------- */
  function renderHelp() {
    var body = $('#body-help'); body.innerHTML = '';
    if (window.MZNews) { // v1.23: novidades das últimas versões
      var news = section(T('Novidades'));
      window.MZNews.LIST.slice(0, 3).forEach(function (e) {
        news.appendChild(h('p', 'news-ver', 'v' + e.v));
        var ul = h('ul', 'rules'); window.MZNews.lines(e, window.MZI18n.lang).forEach(function (l) { ul.appendChild(h('li', '', l)); }); news.appendChild(ul);
      });
      body.appendChild(news);
    }
    var tut = section(T('Tutorial'), T('Passos curtos, com prática no tabuleiro. Dá para pular a qualquer momento.'));
    tut.appendChild(btn(T('Ver tutorial'), 'primary', function () { G.startTutorial('help'); }));
    body.appendChild(tut);

    function block(title, lines) { var s = section(T(title)), ul = h('ul', 'rules'); lines.forEach(function (l) { ul.appendChild(h('li', '', l)); }); s.appendChild(ul); body.appendChild(s); }
    var sc = G.Progress && window.MZLogic.CONFIG.score;
    block('Como jogar', [
      T('Arraste uma das 3 peças até o tabuleiro 8×8. Enquanto arrasta, a área de encaixe aparece destacada.'),
      T('As peças não giram. Não dá para encaixar fora do tabuleiro nem sobre blocos.'),
      T('Linha ou coluna cheia some. Várias ao mesmo tempo somem juntas.'),
      T('Quando as 3 peças forem usadas, chegam 3 novas.'),
      T('Clássico: a partida acaba quando nenhuma peça cabe.')
    ]);
    block('Pontos', [
      T('Cada bloco colocado: {n} pontos.', { n: sc.perBlock }),
      T('Linhas: {k} × (linhas)² — 1 linha = {a}, 2 = {b}, 3 = {c}.', { k: fmt(sc.perLineSquared), a: fmt(sc.perLineSquared), b: fmt(sc.perLineSquared * 4), c: fmt(sc.perLineSquared * 9) }),
      T('Combo: limpe de novo em até 3 peças. Cada nível de combo soma +{p}% nos pontos das linhas. As bolinhas ao lado do tema mostram quantas peças restam.', { p: Math.round(sc.comboBonus * 100) }),
      T('Fase: a cada {k} linhas limpas você sobe de fase e TODOS os pontos são multiplicados (Fase 2 ×{a}, Fase 5 ×{b}, Fase 10 ×{c}, Fase 15 ×{d}). Partidas longas valem muito mais!',
        { k: sc.levelEvery, a: G.multText(2), b: G.multText(5), c: G.multText(10), d: G.multText(15) }),
      T('Tabuleiro vazio: +{n} × multiplicador.', { n: fmt(sc.boardClear) }),
      T('O visual da tela (8 estilos) muda sozinho em jogadas especiais; só a aparência muda.')
    ]);
    block('Modos', [T('Clássico: recorde próprio, 1 desfazer por partida.'), T('Zen: sem fim de partida; quando nada couber, você limpa as 3 linhas mais cheias e segue. Recorde próprio.'),
      T('Desafios: objetivo e limite de peças mostrados antes de começar. Desafio do dia: mesmas 30 peças para todos.')]);
    block('Controles', [T('Toque e arraste com o dedo; a peça fica acima do dedo para você enxergar.'), T('No computador: mouse, ou teclas 1, 2 e 3 para escolher, setas para mover, Enter para colocar e Esc para cancelar.'),
      T('Botão ↶ no topo: desfaz a última jogada (1 vez por partida, exceto no Desafio do dia).'), T('No Zen, depois de usar "Limpar e continuar", os pontos seguem valendo para o recorde Zen, mas não para conquistas de pontos nem para descobrir temas.')]);
    block('Acessibilidade', [T('Configurações → Símbolos nos blocos: cada cor ganha uma forma (círculo, triângulo, quadrado…).'), T('Animações completas, reduzidas ou desligadas.'), T('Som, música e vibração com controles separados.')]);

    var priv = section(T('Privacidade e dados'), T('O Kablox não tem contas, anúncios, compras nem coleta de dados. Recordes, preferências, estatísticas e partidas salvas ficam só neste aparelho (armazenamento do navegador). O site onde o jogo está hospedado pode registrar acessos (como qualquer site) ao baixar os arquivos.'));
    priv.appendChild(h('p', 'm-note', T('Apagar os dados do site nas configurações do navegador, ou desinstalar o app, também apaga tudo.')));
    var del = btn(T('Apagar todos os dados do jogo'), 'ghost-dark', function () {
      G.showDialog({
        title: T('Apagar todos os dados?'),
        list: [T('Recordes, estatísticas, conquistas, estrelas, estilos liberados, preferências e partidas salvas serão apagados deste aparelho.'), T('Isso não pode ser desfeito.')],
        buttons: [{ label: T('Apagar tudo'), cls: 'confirm', fn: G.resetAll }, { label: T('Cancelar'), cls: 'primary', fn: G.closeDialog }]
      });
    });
    priv.appendChild(del);
    body.appendChild(priv);
    body.appendChild(h('p', 'version', 'Kablox v' + G.VERSION));
  }

  var renderers = { events: renderEvents, modes: renderModes, challenges: renderChallenges, collection: renderCollection, stats: renderStats, records: renderRecords, help: renderHelp };
  window.GBMenus = {
    onShow: function (name) {
      if (renderers[name]) { renderers[name](); var b = document.querySelector('#screen-' + name + ' .menu-body'); if (b) b.scrollTop = 0; }
    },
    refresh: function (name) { // v1.25: redesenha sem voltar para o topo (ex.: imagem dos blocos acabou de carregar)
      var b = document.querySelector('#screen-' + name + ' .menu-body'), top = b ? b.scrollTop : 0;
      if (renderers[name]) { renderers[name](); if (b) b.scrollTop = top; }
    }
  };
})();
