/**
 * CONFIGURAÇÃO GLOBAL DO BOLÃO DA MEGA DA VIRADA
 * 
 * 1. API_URL:
 *    - Cole aqui a URL do Web App gerada após implantar o script no Google Apps Script.
 *    - Exemplo: "https://script.google.com/macros/s/AKfycbx.../exec"
 *    - Se deixar vazio (""), o sistema rodará em MODO LOCAL/DEMO usando LocalStorage
 *      para você testar todas as telas imediatamente no navegador!
 * 
 * 2. PIX_CONFIG:
 *    - Chave PIX, Tipo e Nome do titular para pagamento dos participantes.
 */

const CONFIG = {
  // Insira a URL do seu Google Apps Script aqui (veja o README.md para instruções)
  API_URL: "https://script.google.com/macros/s/AKfycbxG_VboyLg2lru2tPA24lHnNrFfWK9rQqvCxGKa92MmZT4U5_NX2sugyPVsKM9-4iya/exec",

  // Dados do PIX para pagamento
  PIX: {
    chave: "pix.bolao.mega@exemplo.com",
    tipoChave: "E-mail", // Chave Aleatória, CPF, Telefone ou E-mail
    titular: "Organizador do Bolão da Família",
    cidade: "SAO PAULO",
    valorTotal: 45.00,
    valorJogosIndividuais: 30.00, // 5 jogos x R$ 6,00
    valorFundoBolao: 15.00        // Fundo comunitário para super jogos de 7+ dezenas
  },

  // Senha padrão de acesso ao painel de administração (usada no modo local)
  ADMIN_SENHA_PADRAO: "adminmega2025",

  // Nome do evento / título
  TITULO_BOLAO: "Bolão da Família & Amigos",
  ANO_EDICAO: "2025 / 2026",
  DATA_SORTEIO: "31/12/2025 às 20h"
};
