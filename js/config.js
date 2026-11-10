// URL da implantação do Google Apps Script (Implantar > Gerenciar implantações).
// Deixe vazio ("") para rodar em MODO DEMONSTRAÇÃO, com os dados salvos só no navegador.
export const API_URL =
  "https://script.google.com/macros/s/AKfycbxG_VboyLg2lru2tPA24lHnNrFfWK9rQqvCxGKa92MmZT4U5_NX2sugyPVsKM9-4iya/exec";

export const API_TIMEOUT_MS = 45_000;

export const EDICAO = {
  titulo: "Bolão da Família & Amigos",
  dataSorteio: "31/12/2026",
  horaSorteio: "20h",
  // Os jogos são registrados antes por causa da instabilidade do sistema das loterias em 30 e 31/12.
  prazoPagamento: "28/12 às 12h",
  registroJogos: "28/12 às 18h",
  premioEstimado: "mais de R$ 1 bilhão",
};

/** Regras da cota. O valor total pode ser sobrescrito pela chave ValorTotal da aba Config. */
export const COTA = {
  total: 45,
  precoAposta: 6, // aposta simples de 6 dezenas
};

export const JOGOS_POR_PARTICIPANTE = 5;
export const DEZENAS_POR_JOGO = 6;
export const TAMANHOS_JOGO_OFICIAL = [6, 7, 8, 9];

/** Usado apenas no modo demonstração (no modo real os dados vêm da aba Config da planilha). */
export const DEMO = {
  adminSenha: "adminmega2025",
  pix: { chave: "pix.bolao.mega@exemplo.com", tipo: "E-mail", titular: "Organizador do Bolão" },
};
