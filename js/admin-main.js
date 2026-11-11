import { isDemo } from "./api.js";
import { DEMO } from "./config.js";
import { state } from "./state.js";
import { $, showView, toast, openDialog, closeDialog, enableBackdropClose } from "./ui.js";
import { setupPwa } from "./pwa.js";
import * as admin from "./admin.js";

// ---------- Ações de clique (data-action) ----------

const actions = {
  "open-dialog": (el) => openDialog(el.dataset.dialog),
  "close-dialog": (el) => closeDialog(el),
  logout: () => {
    admin.sair();
    toast("Sessão administrativa encerrada.", "info");
  },

  "refresh-admin": (el) => admin.carregarAdmin(el),
  tab: (el) => admin.trocarAba(el.dataset.tab),
  "close-bolao": (el) => admin.fecharBolao(el),
  "open-bolao": (el) => admin.reabrirBolao(el),
  "confirm-lottery": (el) => admin.confirmarLoteria(el),

  "toggle-payment": (el) => admin.alternarPagamento(el),
  "view-games": (el) => admin.verJogos(el),
  "open-payments": (el) => admin.abrirPagamentos(el),
  "delete-payment": (el) => admin.removerPagamento(el),
  "delete-participant": (el) => admin.excluirParticipante(el),
  "bulk-pay": (el) => admin.darBaixaEmLote(el),
  "bulk-delete": (el) => admin.excluirEmLote(el),
  "bulk-clear": () => admin.desmarcarTodos(),

  "game-size": (el) => admin.definirTamanho(el),
  "admin-surpresinha": () => admin.surpresinha(),
  "admin-clear": () => admin.limparSelecao(),
  "save-official": (el) => admin.salvarJogoOficial(el),
  "delete-official": (el) => admin.excluirJogoOficial(el),

  "export-txt": (el) => admin.exportarTxt(el),
  "export-pdf": (el) => admin.exportarPdf(el),
};

const forms = {
  "form-admin-login": admin.adminLogin,
  "form-adm-pix": admin.salvarPix,
  "form-pagamento": admin.lancarPagamento,
  "form-conferencia": admin.conferir,
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

  document.addEventListener("input", (e) => {
    if (e.target.id === "adm-busca") admin.renderTabela();
    else if (e.target.id === "cfg-valor") admin.atualizarDivisaoCota();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "adm-filtro") admin.renderTabela();
    else if (e.target.id === "adm-check-todos") admin.marcarTodos(e.target);
    else if (e.target.matches(".row-check")) admin.marcarParticipante(e.target);
  });
}

// ---------- Inicialização ----------

async function boot() {
  enableBackdropClose();
  bindEvents();
  setupPwa();
  admin.setupSeletorJogo();
  admin.trocarAba("participantes");

  $("#demo-banner").hidden = !isDemo;
  $("#demo-senha").textContent = DEMO.adminSenha;
  showView("view-admin-login");

  // Restaura a sessão (senha guardada na sessionStorage até fechar a aba)
  if (state.adminPassword && !(await admin.carregarAdmin())) showView("view-admin-login");
}

boot();
