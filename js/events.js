/* v1.24 (pedido do dono): EVENTOS POR DATA — o primeiro é a "Semana do Terror" (Halloween), até domingo 8/11/2026.
 * Durante o evento: blocos de abóbora aparecem nas peças, morcegos e lua no fundo, sons assustadores leves e um
 * Desafio do evento (limpar 25 abóboras numa partida) que dá a abóbora como bloco raro para sempre.
 * Fora das datas tudo some sozinho. Teste: ?debug&event=terror em localhost. */
(function (root) {
  'use strict';
  var LIST = [
    { id: 'terror2026', from: '2026-11-02', to: '2026-11-08', name: 'Semana do Terror', icon: '🎃', rare: 'pk', goal: 25,
      chance: 0.18, goalChance: 0.35 }
  ];
  function current(dayKey, force) {
    if (force) return LIST.filter(function (e) { return e.id.indexOf(force) === 0; })[0] || null;
    return LIST.filter(function (e) { return dayKey >= e.from && dayKey <= e.to; })[0] || null;
  }
  var api = { LIST: LIST, current: current };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZEvents = api;
})(this);
