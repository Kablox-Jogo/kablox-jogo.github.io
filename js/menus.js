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
  function playClassic() {
    if (!G.tutorialDone()) { G.startTutorial('play'); return; }
    G.confirmReplace('classic', function () { G.startGame('classic'); }, function () { G.startGame('classic', { resume: true }); });
  }
  $('#btn-play').addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); playClassic(); });
  if ($('#home-next')) $('#home-next').addEventListener('click', function () { G.sound.tap(); var g = P.nextGoal(G.stats); G.show(g && g.kind === 'achievement' ? 'stats' : 'collection'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); G.show(b.getAttribute('data-go')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { G.sound.tap(); G.show('home'); });
  });

  /* ---------------- modos ---------------- */
  function renderModes() {
    var body = $('#body-modes'); body.innerHTML = '';
    ['classic', 'zen', 'challenge'].forEach(function (id) {
      var m = P.MODES[id], card = h('article', 'mode-card');
      var head = h('div', 'mode-head');
      head.innerHTML = icon('i-' + m.icon, 26);
      var tw = h('div'); tw.appendChild(h('h3', '', T(m.name))); tw.appendChild(h('p', 'm-note', T(m.desc))); head.appendChild(tw);
      card.appendChild(head);
      var ul = h('ul', 'rules'); m.rules.forEach(function (r) { ul.appendChild(h('li', '', T(r))); }); card.appendChild(ul);
      var row = h('div', 'mode-actions');
      if (id === 'challenge') {
        card.appendChild(h('p', 'mode-best', T('{a} de {b} desafios concluídos · {s} estrelas', { a: P.doneChallenges(G.stats), b: P.CHALLENGES.length, s: P.stars(G.stats) })));
        row.appendChild(btn(T('Ver desafios'), 'primary', function () { G.show('challenges'); }));
      } else {
        card.appendChild(h('p', 'mode-best', T('Recorde {mode}: {n}', { mode: T(m.name), n: fmt(G.bestFor(id)) })));
        if (G.hasSave(id)) row.appendChild(btn(T('Continuar'), 'primary', function () { G.startGame(id, { resume: true }); }));
        row.appendChild(btn(G.hasSave(id) ? T('Nova partida') : T('Jogar'), G.hasSave(id) ? '' : 'primary', function () {
          if (id === 'classic' && !G.tutorialDone()) { G.startTutorial('play'); return; }
          G.confirmReplace(id, function () { G.startGame(id); }, function () { G.startGame(id, { resume: true }); });
        }));
      }
      card.appendChild(row);
      body.appendChild(card);
    });
  }

  /* ---------------- desafios e missões ---------------- */
  function renderChallenges() {
    var body = $('#body-challenges'), st = G.stats, day = G.today(); body.innerHTML = '';
    P.ensureMissions(st, day); G.saveStats();

    var d = P.daily(day), sec = section(T('Desafio do dia'), d.text + ' ' + T('Mesmas peças para todo mundo hoje: compare com seus amigos.'));
    var info = h('p', 'mode-best', st.daily.day === day && st.daily.played
      ? T(st.daily.played > 1 ? 'Seu melhor hoje: {n} pontos ({k} tentativas)' : 'Seu melhor hoje: {n} pontos ({k} tentativa)', { n: fmt(st.daily.best), k: st.daily.played })
      : T('Você ainda não jogou hoje.'));
    sec.appendChild(info);
    var row = h('div', 'mode-actions');
    if (G.hasSave('daily')) row.appendChild(btn(T('Continuar'), 'primary', function () { G.startGame('daily', { resume: true }); }));
    row.appendChild(btn(st.daily.day === day && st.daily.played ? T('Jogar de novo') : T('Jogar'), G.hasSave('daily') ? '' : 'primary', function () {
      G.confirmReplace('daily', function () { G.startGame('daily'); }, function () { G.startGame('daily', { resume: true }); });
    }));
    sec.appendChild(row);
    body.appendChild(sec);

    var ms = section(T('Missões de hoje'), T('Opcionais. Cada missão vale 1 estrela. Se você não jogar num dia, nada é perdido.'));
    var ul = h('ul', 'mission-list');
    st.missions.forEach(function (m) {
      var def = P.missionDef(m.id), li = h('li', m.done ? 'done' : '');
      var top = h('div', 'mission-top');
      top.innerHTML = m.done ? icon('i-check', 20) : icon('i-star', 18);
      top.appendChild(h('span', '', T(def.text)));
      top.appendChild(h('b', '', m.done ? T('Feito') : (def.stat === 'gameScore' ? fmt(m.cur) + '/' + fmt(def.target) : m.cur + '/' + def.target)));
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
        var b = h('button', 'ch-item' + (rec && rec.stars ? ' done' : '') + (lvOpen ? '' : ' locked'));
        b.appendChild(h('span', 'ch-num', String(i + 1)));
        var tx = h('span', 'ch-text'), nm = h('strong', '', T(c.name));
        if (c.boss) nm.appendChild(h('span', 'boss-tag', T('CHEFE')));
        tx.appendChild(nm);
        tx.appendChild(h('small', c.goal === 'gems' ? 'gem-tag' : '', P.goalText(c) + ' · ' + T('{n} peças', { n: c.pieces })));
        b.appendChild(tx);
        if (lvOpen) b.appendChild(stars(rec ? rec.stars : 0)); else b.insertAdjacentHTML('beforeend', icon('i-lock', 18));
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
    var sec = section(T('Recorde por modo'));
    var g = h('div', 'stat-grid');
    [[fmt(st.best.classic), T('Recorde Clássico')], [fmt(st.best.zen), T('Recorde Zen')],
      [st.daily.day === day && st.daily.played ? fmt(st.daily.best) : '—', T('Melhor do dia de hoje')],
      [P.doneChallenges(st) + '/' + P.CHALLENGES.length, T('Desafios concluídos')], [fmt(P.stars(st)), T('Estrelas')],
      [st.bestCombo ? '×' + st.bestCombo : '—', T('Maior combo')]
    ].forEach(function (it) { var d = h('div'); d.appendChild(h('strong', '', it[0])); d.appendChild(h('span', '', it[1])); g.appendChild(d); });
    sec.appendChild(g);
    body.appendChild(sec);

    var top = section(T('Melhores partidas'), T('As 10 maiores pontuações deste aparelho (Clássico e Desafio do dia).'));
    var list = G.records();
    if (!list.length) top.appendChild(h('p', 'mode-best', T('Nenhuma partida terminada ainda. Jogue uma para aparecer aqui.')));
    else {
      var ol = h('ol', 'rec-list');
      list.forEach(function (r, i) {
        var li = h('li', i === 0 ? 'first' : '');
        li.appendChild(h('span', 'rec-pos', String(i + 1)));
        var tx = h('span', 'ch-text');
        tx.appendChild(h('strong', '', fmt(r.score)));
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
      T('Nível: a cada {k} linhas limpas você sobe de nível e TODOS os pontos são multiplicados (Nv 2 ×{a}, Nv 5 ×{b}, Nv 10 ×{c}, Nv 15 ×{d}). Partidas longas valem muito mais!',
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

  var renderers = { modes: renderModes, challenges: renderChallenges, collection: renderCollection, stats: renderStats, records: renderRecords, help: renderHelp };
  window.GBMenus = {
    onShow: function (name) {
      if (renderers[name]) { renderers[name](); var b = document.querySelector('#screen-' + name + ' .menu-body'); if (b) b.scrollTop = 0; }
    }
  };
})();
