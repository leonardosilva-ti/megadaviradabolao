import { API_URL, API_TIMEOUT_MS } from "./config.js";
import { mockRequest } from "./mock.js";

/** Sem URL configurada o site roda em modo demonstração (dados no localStorage). */
export const isDemo = !API_URL.trim();

let pending = 0;

function track(delta) {
  pending = Math.max(0, pending + delta);
  const el = document.getElementById("progress");
  if (el) el.hidden = pending === 0;
}

/** O backend devolve erros em `error`; padroniza tudo em `message`. */
function normalize(data) {
  if (!data || typeof data !== "object") return { success: false, message: "Resposta vazia do servidor." };
  if (!data.message && data.error) data.message = data.error;
  // Passe vencido/inválido: a tela volta para o login (tratado em main.js / admin-main.js)
  if (data.sessaoExpirada) window.dispatchEvent(new CustomEvent("sessao-expirada", { detail: data.message }));
  return data;
}

async function remote(action, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      // text/plain evita o preflight de CORS (o Apps Script não responde OPTIONS)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, action }),
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chama uma ação do Apps Script (ou do simulador local).
 * Nunca lança exceção: sempre retorna { success, message, ... }.
 */
export async function api(action, payload = {}) {
  track(+1);
  try {
    return normalize(isDemo ? await mockRequest(action, payload) : await remote(action, payload));
  } catch (error) {
    console.error(`[api] ${action}`, error);
    const message = error.name === "AbortError"
      ? "O servidor demorou demais para responder. Tente novamente."
      : "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.";
    return { success: false, message };
  } finally {
    track(-1);
  }
}
