import { isDemo } from "./api.js";
import { EDICAO } from "./config.js";
import { state, clearSession } from "./state.js";
import { $, showView, toast, openDialog, closeDialog, enableBackdropClose, setupMasks, openCalendar } from "./ui.js";
import { formatPhone, formatDateMask } from "./utils.js";
import { setupPwa, instalarApp } from "./pwa.js";
import * as p from "./participante.js";

// ---------- Ações de clique (data-action) ----------

const actions = {
  "go-login": () => showView("view-login"),
  "go-register": () => showView("view-register"),
  "open-calendar": (el) => openCalendar(el.dataset.target),
  "open-dialog": (el) => openDialog(el.dataset.dialog),
  "close-dialog": (el) => closeDialog(el),
  install: () => instalarApp(),
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
  "download-receipt": () => p.baixarComprovante(),
  "download-all-games": () => p.baixarTodosOsJogos(),

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
  p.setupWizard();
  p.renderValores();

  $("#data-sorteio").textContent = EDICAO.dataSorteio;
  $("#demo-banner").hidden = !isDemo;
  showView("view-login");

  // Restaura a sessão do participante (guardada no localStorage)
  if (state.user?.id) await p.abrirPainelOuWizard();
}

boot();
