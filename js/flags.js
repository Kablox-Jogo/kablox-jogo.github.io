/* v1.26 (dono, 09/11): partes que só entram depois que o dono aprovar o desenho.
 * false = desligado no site (o código fica, nada é apagado; o progresso guardado continua).
 * Para ver ligado na prévia/testes: ?feat=all (só em localhost) ou trocar aqui para true. */
(function (root) {
  'use strict';
  var F = { helpers: false, legends: false, zenNew: false };
  try {
    if (/[?&]feat=all\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) F = { helpers: true, legends: true, zenNew: true };
  } catch (e) {}
  root.MZFlags = F;
})(this);
