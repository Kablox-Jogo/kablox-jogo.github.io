/* v1.24 (pedido do dono): EVENTOS POR DATA — o primeiro é a "Semana do Terror" (Halloween), até domingo 8/11/2026.
 * Durante o evento: blocos de abóbora aparecem nas peças, morcegos e lua no fundo, sons assustadores leves e um
 * Desafio do evento (limpar 25 abóboras numa partida) que dá a abóbora como bloco raro para sempre.
 * Fora das datas tudo some sozinho. Teste: ?debug&event=terror em localhost. */
(function (root) {
  'use strict';
  var LIST = [
    { id: 'terror2026', from: '2026-11-02', to: '2026-11-08', name: 'Semana do Terror', icon: '🎃', theme: 'terror', prize: 'pk', rare: 'pk', goal: 40, flee: 6, nightmare: { goal: 40, flee: 4, badge: 'Selo Pesadelo 2026' }, // v1.25 (dono): mais difícil — 40 morcegos, morcego foge em 6 jogadas; Pesadelo: sem desfazer/reviver, foge em 4 // pk = gaiola com morcego (v1.25; antes abóbora) — id mantido para não perder o prêmio de quem já ganhou
     
      chance: 0.18, goalChance: 0.42, badge: 'Selo Terror 2026',
      // v1.25: coleção do evento (blocos de Halloween das imagens do dono, js/halloween-art.js), na mesma ordem da folha
      album: [['classic', 'Clássico Hallow'], ['theme', 'Do Tema Hallow'], ['ice', 'Gelo Sombrio'], ['stone', 'Pedra Maldita'], ['fur', 'Pelúcia Monstruosa'],
        ['jelly', 'Gelatina Hallow'], ['neon', 'Neon Sombrio'], ['wood', 'Madeira Rúnica'], ['candy', 'Doce Macabro'], ['glossy', 'Brilho Assustador'],
        ['crystal', 'Cristal Obscuro'], ['metal', 'Metálico Sombrio'], ['gradient', 'Gradiente Hallow'], ['galaxy', 'Galáxia Sombria'], ['ocean', 'Oceano Sombrio'],
        ['cheese', 'Queijo Estranho'], ['wool', 'Lã Sombria'], ['rainbow', 'Arco-íris Hallow'], ['lava', 'Lava Hallow'], ['gold', 'Ouro Amaldiçoado'],
        ['circuit', 'Circuito Hallow'], ['stained', 'Vitral Sombrio'], ['v-verdeagua', 'Verde-água Hallow'], ['v-brancoazul', 'Branco e Azul Hallow'], ['v-terra', 'Marrom e Laranja Hallow']] }
  ];
  // v1.28 (laboratório): NATAL. Mesma estrutura do Halloween; o item do desafio é um presente (código interno 'pk' = "item do evento",
  // desenho e textos mudam pelo tema). Prêmio guardado em stats.rares.gf. Blocos de Natal: esperando as imagens do dono (album vazio).
  // Só liga com a chave `natal` (js/flags.js) — no site fica "em breve" até o dono aprovar.
  // v1.29 (dono: "uma mais fácil, uma bem mais difícil, outra bem mais difícil"): 3 níveis, todos com meta de 50 presentes; muda o resto.
  // Medido com robô (tools/event_sim.js, robô "bom", sem desfazer): Desafio 6% · Noite Feliz 2% · Nevasca 1% (Halloween: 15%).
  // gold = chance do presente DOURADO (vale 3, some 2 jogadas antes). hard = peças mais difíceis (js/logic.js). snow = bola de neve cai a cada N jogadas.
  LIST.push({ id: 'natal2026', from: '2026-12-01', to: '2026-12-31', name: 'Natal', icon: '🎄', theme: 'natal', prize: 'gf', flag: 'natal', rare: 'pk',
    goal: 50, flee: 5, goalChance: 0.42, gold: 0.12, chance: 0.18, badge: 'Selo Natal 2026', album: [],
    nightmare: { goal: 50, flee: 4, chance: 0.65, gold: 0.12, hard: 2, badge: 'Selo Noite Feliz 2026' },
    storm: { goal: 50, flee: 3, chance: 0.7, gold: 0.15, hard: 2, snow: 12, badge: 'Selo Nevasca 2026' } });
  function flagOn(e) { var F = root && root.MZFlags; return !e.flag || !!(F && F[e.flag]); }
  function isSoon(e) { return !!e.soon || !flagOn(e); } // anunciado, mas ainda sem conteúdo ligado
  // v1.29: nomes dos 25 blocos de Natal, na mesma ordem da folha (tools/cut_blocks.py). Só entram no álbum quando js/natal-art.js existir
  // (o app.js liga sozinho ao abrir). Os nomes podem mudar para os da imagem do dono.
  var NATAL_ALBUM = [['classic', 'Clássico Natalino'], ['theme', 'Do Tema Natal'], ['ice', 'Gelo de Natal'], ['stone', 'Pedra Nevada'], ['fur', 'Pelúcia Natalina'],
    ['jelly', 'Gelatina de Natal'], ['neon', 'Neon Pisca-pisca'], ['wood', 'Madeira de Trenó'], ['candy', 'Bengala Doce'], ['glossy', 'Brilho Natalino'],
    ['crystal', 'Cristal de Neve'], ['metal', 'Sino Prateado'], ['gradient', 'Gradiente Natal'], ['galaxy', 'Céu de Natal'], ['ocean', 'Mar Gelado'],
    ['cheese', 'Queijo da Ceia'], ['wool', 'Lã de Inverno'], ['rainbow', 'Arco-íris Natalino'], ['lava', 'Brasa da Lareira'], ['gold', 'Ouro de Natal'],
    ['circuit', 'Circuito de Luzinhas'], ['stained', 'Vitral Natalino'], ['v-verdeagua', 'Verde-água Natal'], ['v-brancoazul', 'Branco e Azul Natal'], ['v-terra', 'Marrom e Laranja Natal']];
  function current(dayKey, force) {
    if (force) return LIST.filter(function (e) { return !isSoon(e) && e.id.indexOf(force) === 0; })[0] || null;
    return LIST.filter(function (e) { return !isSoon(e) && dayKey >= e.from && dayKey <= e.to; })[0] || null;
  }
  function stateOf(e, dayKey) { return dayKey < e.from ? 'future' : dayKey > e.to ? 'ended' : 'active'; } // futuro / ativo / encerrado
  function byId(id) { return LIST.filter(function (e) { return e.id === id; })[0] || null; }
  var api = { LIST: LIST, current: current, byId: byId, stateOf: stateOf, isSoon: isSoon, NATAL_ALBUM: NATAL_ALBUM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZEvents = api;
})(this);
