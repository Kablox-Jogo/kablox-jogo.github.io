/* v1.24 (pedido do dono): EVENTOS POR DATA — o primeiro é a "Semana do Terror" (Halloween), até domingo 8/11/2026.
 * Durante o evento: blocos de abóbora aparecem nas peças, morcegos e lua no fundo, sons assustadores leves e um
 * Desafio do evento (limpar 25 abóboras numa partida) que dá a abóbora como bloco raro para sempre.
 * Fora das datas tudo some sozinho. Teste: ?debug&event=terror em localhost. */
(function (root) {
  'use strict';
  var LIST = [
    { id: 'terror2026', from: '2026-11-02', to: '2026-11-08', name: 'Semana do Terror', icon: '🎃', rare: 'pk', goal: 40, flee: 6, nightmare: { goal: 40, flee: 4, badge: 'Selo Pesadelo 2026' }, // v1.25 (dono): mais difícil — 40 morcegos, morcego foge em 6 jogadas; Pesadelo: sem desfazer/reviver, foge em 4 // pk = gaiola com morcego (v1.25; antes abóbora) — id mantido para não perder o prêmio de quem já ganhou
     
      chance: 0.18, goalChance: 0.42, badge: 'Selo Terror 2026',
      // v1.25: coleção do evento (blocos de Halloween das imagens do dono, js/halloween-art.js), na mesma ordem da folha
      album: [['classic', 'Clássico Hallow'], ['theme', 'Do Tema Hallow'], ['ice', 'Gelo Sombrio'], ['stone', 'Pedra Maldita'], ['fur', 'Pelúcia Monstruosa'],
        ['jelly', 'Gelatina Hallow'], ['neon', 'Neon Sombrio'], ['wood', 'Madeira Rúnica'], ['candy', 'Doce Macabro'], ['glossy', 'Brilho Assustador'],
        ['crystal', 'Cristal Obscuro'], ['metal', 'Metálico Sombrio'], ['gradient', 'Gradiente Hallow'], ['galaxy', 'Galáxia Sombria'], ['ocean', 'Oceano Sombrio'],
        ['cheese', 'Queijo Estranho'], ['wool', 'Lã Sombria'], ['rainbow', 'Arco-íris Hallow'], ['lava', 'Lava Hallow'], ['gold', 'Ouro Amaldiçoado'],
        ['circuit', 'Circuito Hallow'], ['stained', 'Vitral Sombrio'], ['v-verdeagua', 'Verde-água Hallow'], ['v-brancoazul', 'Branco e Azul Hallow'], ['v-terra', 'Marrom e Laranja Hallow']] }
  ];
  function current(dayKey, force) {
    if (force) return LIST.filter(function (e) { return e.id.indexOf(force) === 0; })[0] || null;
    return LIST.filter(function (e) { return dayKey >= e.from && dayKey <= e.to; })[0] || null;
  }
  function byId(id) { return LIST.filter(function (e) { return e.id === id; })[0] || null; }
  var api = { LIST: LIST, current: current, byId: byId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZEvents = api;
})(this);
