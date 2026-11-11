import { JOGOS_POR_PARTICIPANTE } from "./config.js";
import { local, session } from "./utils.js";

// Mesmas chaves da versão anterior, para não deslogar quem já estava logado.
const USER_KEY = "megadavirada_session_user";
const ADMIN_KEY = "megadavirada_admin_sessao"; // passe assinado do painel (nunca a senha)
const OLD_ADMIN_KEY = "megadavirada_admin_pass"; // versão antiga guardava a senha: apagamos
const PAYMENT_KEY = "megadavirada_pagamento_informado";

const novoWizard = () => ({ step: 0, games: Array.from({ length: JOGOS_POR_PARTICIPANTE }, () => []) });

session.remove(OLD_ADMIN_KEY);

/** Estado global da aplicação (em memória + sessão no armazenamento do navegador). */
export const state = {
  user: local.get(USER_KEY),
  adminToken: session.get(ADMIN_KEY),
  dashboard: null,
  config: null,
  publicConfig: null, // configuração pública (antes do login), ex.: WhatsApp do organizador
  wizard: novoWizard(),
  admin: { data: null, tamanho: 7, selecionadas: [] },
};

export function setUser(user) {
  state.user = user || null;
  user ? local.set(USER_KEY, user) : local.remove(USER_KEY);
}

export function setAdminToken(token) {
  state.adminToken = token || null;
  token ? session.set(ADMIN_KEY, token) : session.remove(ADMIN_KEY);
}

export function resetWizard() {
  state.wizard = novoWizard();
}

/**
 * O backend só avisa o organizador por e-mail; guardamos localmente que o aviso foi enviado.
 * Com pagamento em partes, o aviso vale para o valor já registrado naquele momento: quando o
 * organizador lança uma parte, o participante pode avisar de novo ao pagar o restante.
 */
const chaveAviso = (id, valorPago) => (Number(valorPago) > 0 ? `${id}:${Number(valorPago).toFixed(2)}` : id);
export const pagamentoInformado = (id, valorPago = 0) => (local.get(PAYMENT_KEY) ?? []).includes(chaveAviso(id, valorPago));
export function marcarPagamentoInformado(id, valorPago = 0) {
  const ids = new Set(local.get(PAYMENT_KEY) ?? []);
  ids.add(chaveAviso(id, valorPago));
  local.set(PAYMENT_KEY, [...ids]);
}

export function clearSession() {
  setUser(null);
  setAdminToken(null);
  state.dashboard = null;
  state.config = null;
  state.admin = { data: null, tamanho: 7, selecionadas: [] };
  resetWizard();
}
