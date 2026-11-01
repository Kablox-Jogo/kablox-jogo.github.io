/* Kablox — biblioteca de peças (formatos geométricos).
 * Cada peça: desenho em linhas ('#' bloco, '.' vazio), nome, categoria e peso de sorteio.
 * A ORDEM importa: o número de cada peça é a sua posição nesta lista e fica gravado nas partidas
 * salvas. Para incluir formatos novos, acrescente SEMPRE no fim.
 * As peças não giram: cada orientação é uma peça própria.
 * minScore (opcional): a peça só começa a aparecer a partir desses pontos na partida (dificuldade progressiva).
 */
(function (root) {
  'use strict';

  var LIST = [
    // retas
    { name: 'Bloco único', cat: 'reta', rows: ['#'], weight: 4 },
    { name: 'Reta de 2 deitada', cat: 'reta', rows: ['##'], weight: 6 },
    { name: 'Reta de 2 em pé', cat: 'reta', rows: ['#', '#'], weight: 6 },
    { name: 'Reta de 3 deitada', cat: 'reta', rows: ['###'], weight: 6 },
    { name: 'Reta de 3 em pé', cat: 'reta', rows: ['#', '#', '#'], weight: 6 },
    { name: 'Reta de 4 deitada', cat: 'reta', rows: ['####'], weight: 4 },
    { name: 'Reta de 4 em pé', cat: 'reta', rows: ['#', '#', '#', '#'], weight: 4 },
    { name: 'Reta de 5 deitada', cat: 'reta', rows: ['#####'], weight: 1 },
    { name: 'Reta de 5 em pé', cat: 'reta', rows: ['#', '#', '#', '#', '#'], weight: 1 },
    // quadrados e retângulos
    { name: 'Quadrado 2×2', cat: 'quadrado', rows: ['##', '##'], weight: 7 },
    { name: 'Quadrado 3×3', cat: 'quadrado', rows: ['###', '###', '###'], weight: 1.2 },
    { name: 'Retângulo 3×2', cat: 'retângulo', rows: ['###', '###'], weight: 1.2 },
    { name: 'Retângulo 2×3', cat: 'retângulo', rows: ['##', '##', '##'], weight: 1.2 },
    // cantos (L pequeno, 3 blocos)
    { name: 'Canto ┌', cat: 'L pequeno', rows: ['##', '#.'], weight: 4 },
    { name: 'Canto ┐', cat: 'L pequeno', rows: ['##', '.#'], weight: 4 },
    { name: 'Canto └', cat: 'L pequeno', rows: ['#.', '##'], weight: 4 },
    { name: 'Canto ┘', cat: 'L pequeno', rows: ['.#', '##'], weight: 4 },
    // L médio (4 blocos)
    { name: 'L médio deitado ┌', cat: 'L médio', rows: ['###', '#..'], weight: 3 },
    { name: 'L médio deitado ┐', cat: 'L médio', rows: ['###', '..#'], weight: 3 },
    { name: 'L médio deitado └', cat: 'L médio', rows: ['#..', '###'], weight: 3 },
    { name: 'L médio deitado ┘', cat: 'L médio', rows: ['..#', '###'], weight: 3 },
    { name: 'L médio em pé ┌', cat: 'L médio', rows: ['##', '#.', '#.'], weight: 3 },
    { name: 'L médio em pé ┐', cat: 'L médio', rows: ['##', '.#', '.#'], weight: 3 },
    { name: 'L médio em pé └', cat: 'L médio', rows: ['#.', '#.', '##'], weight: 3 },
    { name: 'L médio em pé ┘', cat: 'L médio', rows: ['.#', '.#', '##'], weight: 3 },
    // T
    { name: 'T para baixo', cat: 'T', rows: ['###', '.#.'], weight: 3 },
    { name: 'T para cima', cat: 'T', rows: ['.#.', '###'], weight: 3 },
    { name: 'T para a direita', cat: 'T', rows: ['#.', '##', '#.'], weight: 3 },
    { name: 'T para a esquerda', cat: 'T', rows: ['.#', '##', '.#'], weight: 3 },
    // S e Z
    { name: 'Z deitado', cat: 'S/Z', rows: ['##.', '.##'], weight: 2 },
    { name: 'S deitado', cat: 'S/Z', rows: ['.##', '##.'], weight: 2 },
    { name: 'S em pé', cat: 'S/Z', rows: ['#.', '##', '.#'], weight: 2 },
    { name: 'Z em pé', cat: 'S/Z', rows: ['.#', '##', '#.'], weight: 2 },
    // L grande (5 blocos, braços iguais)
    { name: 'L grande └', cat: 'L grande', rows: ['#..', '#..', '###'], weight: 2 },
    { name: 'L grande ┌', cat: 'L grande', rows: ['###', '#..', '#..'], weight: 2 },
    { name: 'L grande ┐', cat: 'L grande', rows: ['###', '..#', '..#'], weight: 2 },
    { name: 'L grande ┘', cat: 'L grande', rows: ['..#', '..#', '###'], weight: 2 },
    // ---- v1.7: formatos novos (sempre no fim) ----
    { name: 'Cruz', cat: 'cruz', rows: ['.#.', '###', '.#.'], weight: 0.6, minScore: 500 },
    { name: 'Escada ↘', cat: 'escada', minScore: 1000, rows: ['#..', '##.', '.##'], weight: 0.4 },
    { name: 'Escada ↙', cat: 'escada', minScore: 1000, rows: ['..#', '.##', '##.'], weight: 0.4 },
    { name: 'Escada ↗', cat: 'escada', minScore: 1000, rows: ['.##', '##.', '#..'], weight: 0.4 },
    { name: 'Escada ↖', cat: 'escada', minScore: 1000, rows: ['##.', '.##', '..#'], weight: 0.4 },
    { name: 'L longo deitado └', cat: 'L longo', minScore: 1500, rows: ['#...', '####'], weight: 0.35 },
    { name: 'L longo deitado ┘', cat: 'L longo', minScore: 1500, rows: ['...#', '####'], weight: 0.35 },
    { name: 'L longo deitado ┌', cat: 'L longo', minScore: 1500, rows: ['####', '#...'], weight: 0.35 },
    { name: 'L longo deitado ┐', cat: 'L longo', minScore: 1500, rows: ['####', '...#'], weight: 0.35 },
    { name: 'L longo em pé └', cat: 'L longo', minScore: 1500, rows: ['#.', '#.', '#.', '##'], weight: 0.35 },
    { name: 'L longo em pé ┘', cat: 'L longo', minScore: 1500, rows: ['.#', '.#', '.#', '##'], weight: 0.35 },
    { name: 'L longo em pé ┌', cat: 'L longo', minScore: 1500, rows: ['##', '#.', '#.', '#.'], weight: 0.35 },
    { name: 'L longo em pé ┐', cat: 'L longo', minScore: 1500, rows: ['##', '.#', '.#', '.#'], weight: 0.35 },
    // v1.21 — diagonais (pedido do dono, visto em jogos do gênero): blocos que se tocam só pela quina. Sempre no fim da lista.
    { name: 'Diagonal de 2 ↘', cat: 'diagonal', diagonal: true, rows: ['#.', '.#'], weight: 0.8 },
    { name: 'Diagonal de 2 ↙', cat: 'diagonal', diagonal: true, rows: ['.#', '#.'], weight: 0.8 },
    { name: 'Diagonal de 3 ↘', cat: 'diagonal', diagonal: true, rows: ['#..', '.#.', '..#'], weight: 0.5 },
    { name: 'Diagonal de 3 ↙', cat: 'diagonal', diagonal: true, rows: ['..#', '.#.', '#..'], weight: 0.5 }
  ];

  /** Confere a geometria de uma peça. Retorna a lista de problemas (vazia = válida). */
  function problems(p) {
    var out = [], rows = p.rows;
    if (!Array.isArray(rows) || !rows.length) return ['sem linhas'];
    var w = rows[0].length;
    if (rows.some(function (r) { return typeof r !== 'string' || r.length !== w; })) out.push('linhas de tamanhos diferentes');
    if (rows.some(function (r) { return /[^#.]/.test(r); })) out.push('caractere inválido');
    if (rows.length > 5 || w > 5) out.push('maior que 5×5');
    if (rows.some(function (r) { return r.indexOf('#') === -1; })) out.push('linha vazia');
    for (var c = 0; c < w; c++) if (rows.every(function (r) { return r[c] !== '#'; })) out.push('coluna vazia');
    if (!(p.weight > 0)) out.push('peso inválido');
    // conectada (vizinhos de lado)
    var cells = [], seen = {};
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === '#') cells.push(y + ',' + x); });
    if (cells.length) {
      var stack = [cells[0]];
      seen[cells[0]] = 1;
      while (stack.length) {
        var k = stack.pop().split(','), y = +k[0], x = +k[1];
        var nb = [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]];
        if (p.diagonal) nb = nb.concat([[y - 1, x - 1], [y - 1, x + 1], [y + 1, x - 1], [y + 1, x + 1]]); // diagonais: ligadas pela quina
        nb.forEach(function (n) {
          var key = n[0] + ',' + n[1];
          if (!seen[key] && rows[n[0]] && rows[n[0]][n[1]] === '#') { seen[key] = 1; stack.push(key); }
        });
      }
      if (Object.keys(seen).length !== cells.length) out.push('blocos soltos');
    }
    return out;
  }

  /** Valida a biblioteca inteira (inclusive formatos repetidos). */
  function validate(list) {
    list = list || LIST;
    var errors = [], keys = {};
    list.forEach(function (p, i) {
      problems(p).forEach(function (e) { errors.push(i + ' (' + p.name + '): ' + e); });
      var key = (p.rows || []).join('|');
      if (keys[key] !== undefined) errors.push(i + ' (' + p.name + '): repete a peça ' + keys[key]);
      keys[key] = i;
    });
    return errors;
  }

  var api = { LIST: LIST, problems: problems, validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZPieces = api;
})(this);
