/**
 * Conferência do resultado — usada pelo painel do organizador e pela tela do participante.
 */
import { pad2 } from "./utils.js";

const comb = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

/**
 * Quantas apostas de 6 dezenas premiadas um jogo de `n` dezenas com `acertos` equivale.
 * Ex.: jogo de 8 dezenas com 5 acertos = 3 quinas + 15 quadras.
 */
export function faixas(n, acertos) {
  return {
    sena: comb(acertos, 6),
    quina: comb(acertos, 5) * comb(n - acertos, 1),
    quadra: comb(acertos, 4) * comb(n - acertos, 2),
  };
}

export const descreverFaixas = (f) => [
  f.sena && `${f.sena} sena${f.sena > 1 ? "s" : ""}`,
  f.quina && `${f.quina} quina${f.quina > 1 ? "s" : ""}`,
  f.quadra && `${f.quadra} quadra${f.quadra > 1 ? "s" : ""}`,
].filter(Boolean).join(" + ");

/**
 * Lê as 6 dezenas sorteadas digitadas ("5 14 23 32 48 57", "05,14,…").
 * Retorna { sorteadas: Set<"05"> } ou { erro: string }.
 */
export function lerSorteadas(texto) {
  const nums = String(texto ?? "").split(/[^\d]+/).filter(Boolean).map(Number);
  if (nums.length !== 6) return { erro: "Informe exatamente as 6 dezenas sorteadas." };
  if (nums.some((n) => n < 1 || n > 60)) return { erro: "As dezenas devem estar entre 01 e 60." };
  if (new Set(nums).size !== 6) return { erro: "Há dezenas repetidas no resultado." };
  return { sorteadas: new Set(nums.map(pad2)) };
}

/**
 * Confere os jogos contra as dezenas sorteadas.
 * @param {{ dezenas: string[], label: string, oficial?: boolean, meu?: boolean }[]} jogos
 * @param {Set<string>} sorteadas
 * @returns {{ premiados: object[], total: { sena: number, quina: number, quadra: number } }}
 *   premiados: jogos com 4+ acertos, do maior para o menor número de acertos.
 */
export function conferirJogos(jogos, sorteadas) {
  const premiados = jogos
    .map((j) => {
      const acertos = j.dezenas.filter((d) => sorteadas.has(d)).length;
      return { ...j, acertos, faixas: faixas(j.dezenas.length, acertos) };
    })
    .filter((j) => j.acertos >= 4)
    .sort((a, b) => b.acertos - a.acertos || b.dezenas.length - a.dezenas.length);

  const total = premiados.reduce((t, j) => ({
    sena: t.sena + j.faixas.sena, quina: t.quina + j.faixas.quina, quadra: t.quadra + j.faixas.quadra,
  }), { sena: 0, quina: 0, quadra: 0 });

  return { premiados, total };
}
