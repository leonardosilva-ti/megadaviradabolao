import { isDemo } from "./api.js";
import { EDICAO } from "./config.js";
import { state, clearSession } from "./state.js";
import { $, showView, toast, openDialog, closeDialog, enableBackdropClose, setupMasks, openCalendar } from "./ui.js";
import { formatPhone, formatDateMask } from "./utils.js";
import { setupPwa, instalarApp } from "./pwa.js";
import * as p from "./participante.js";
import { setupTema, alternarTema } from "./tema.js";

// ---------- Ações de clique (data-action) ----------

const actions = {
  "go-login": () => showView("view-login"),
  "go-register": () => showView("view-register"),
  "open-calendar": (el) => openCalendar(el.dataset.target),
  "open-dialog": (el) => openDialog(el.dataset.dialog),
  "close-dialog": (el) => closeDialog(el),
  install: () => instalarApp(),
  "toggle-theme": () => alternarTema(),
  logout: () => sair(),

  "refresh-dashboard": (el) => p.refreshDashboard(el),
  "go-dashboard": () => p.irParaPainel(),
  "pay-later": () => p.pagarDepois(),
  "invite-whatsapp": () => p.convidarWhatsApp(),
  "invite-share": () => p.convidarApp(),
  "invite-copy": () => p.copiarConvite(),
  "open-payment": () => p.abrirPagamento(),
  "copy-pix": () => p.copiarPix(),
  "notify-payment": (el) => p.avisarPagamento(el),
  "notify-partial": () => p.abrirPagamentoParcial(),
  "download-receipt": (el) => p.baixarComprovante(el),
  "download-all-games": (el) => p.baixarTodosOsJogos(el),

  "start-wizard": () => p.startWizard(),
  "edit-games": () => p.editarJogos(),
  "cancel-edit": () => p.cancelarEdicao(),
  "go-game": (el) => p.irParaJogo(el.dataset.index),
  "prev-game": () => p.jogoAnterior(),
  "next-game": () => p.proximoJogo(),
  surpresinha: () => p.surpresinha(),
  "clear-game": () => p.limparJogo(),
  "back-to-wizard": () => p.voltarAoWizard(),
  "submit-games": (el) => p.enviarJogos(el),
};

const forms = {
  "form-login": p.login,
  "form-register": p.register,
  "form-conf-participante": p.conferirResultado,
  "form-pag-parcial": p.informarPagamentoParcial,
};

function bindEvents() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const handler = actions[el.dataset.action];
    if (handler) {
      e.preventDefault();
      handler(el);
    }
  });

  // "Ver todos os jogos" do grupo: desenha a lista só quando abrir
  $("#dash-outros-lista").addEventListener("toggle", (e) => { if (e.target.open) p.renderJogosDoGrupo(); });

  document.addEventListener("submit", (e) => {
    const handler = forms[e.target.id];
    if (handler) {
      e.preventDefault();
      handler(e.target);
    }
  });
}

function sair() {
  clearSession();
  showView("view-login");
  toast("Você saiu da sua conta.", "info");
}

// ---------- Inicialização ----------

async function boot() {
  setupMasks({ phone: formatPhone, date: formatDateMask });
  enableBackdropClose();
  bindEvents();
  setupPwa();
  setupTema();
  p.setupWizard();
  p.renderValores();

  $("#data-sorteio").textContent = EDICAO.dataSorteio;
  // WhatsApp do organizador para o botão "Tirar dúvidas": quem já está logado recebe junto
  // com o painel, então só busca a configuração pública na tela de acesso.
  p.carregarConfigPublica({ buscar: !state.user?.token });
  $("#demo-banner").hidden = !isDemo;
  showView("view-login");

  // Passe vencido (30 dias) ou inválido: volta para o login
  window.addEventListener("sessao-expirada", (e) => {
    if (!state.user) return;
    clearSession();
    showView("view-login");
    toast(e.detail || "Sua sessão expirou. Entre novamente.", "info");
  });

  // Restaura a sessão do participante (guardada no localStorage).
  // Quem entrou antes dos passes assinados (sem token) precisa entrar de novo uma vez.
  if (state.user?.id && !state.user.token) {
    clearSession();
    toast("Por segurança, entre novamente com seu celular e data de nascimento.", "info");
  } else if (state.user?.id) {
    await p.abrirPainelOuWizard();
  }
}

boot();
