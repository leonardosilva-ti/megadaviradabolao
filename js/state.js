import { JOGOS_POR_PARTICIPANTE } from "./config.js";
import { local, session } from "./utils.js";

// Mesmas chaves da versão anterior, para não deslogar quem já estava logado.
const USER_KEY = "megadavirada_session_user";
const ADMIN_KEY = "megadavirada_admin_pass";
const PAYMENT_KEY = "megadavirada_pagamento_informado";

const novoWizard = () => ({ step: 0, games: Array.from({ length: JOGOS_POR_PARTICIPANTE }, () => []) });

/** Estado global da aplicação (em memória + sessão no armazenamento do navegador). */
export const state = {
  user: local.get(USER_KEY),
  adminPassword: session.get(ADMIN_KEY),
  dashboard: null,
  config: null,
  wizard: novoWizard(),
  admin: { data: null, tamanho: 7, selecionadas: [] },
};

export function setUser(user) {
  state.user = user || null;
  user ? local.set(USER_KEY, user) : local.remove(USER_KEY);
}

export function setAdminPassword(password) {
  state.adminPassword = password || null;
  password ? session.set(ADMIN_KEY, password) : session.remove(ADMIN_KEY);
}

export function resetWizard() {
  state.wizard = novoWizard();
}

/** O backend só avisa o organizador por e-mail; guardamos localmente que o aviso foi enviado. */
export const pagamentoInformado = (id) => (local.get(PAYMENT_KEY) ?? []).includes(id);
export function marcarPagamentoInformado(id) {
  const ids = new Set(local.get(PAYMENT_KEY) ?? []);
  ids.add(id);
  local.set(PAYMENT_KEY, [...ids]);
}

export function clearSession() {
  setUser(null);
  setAdminPassword(null);
  state.dashboard = null;
  state.config = null;
  state.admin = { data: null, tamanho: 7, selecionadas: [] };
  resetWizard();
}
