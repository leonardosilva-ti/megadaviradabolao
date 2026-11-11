/**
 * Modo claro / escuro.
 * Sem escolha salva, o site segue o tema do aparelho; o botão 🌙/☀️ fixa a escolha neste navegador.
 * O tema inicial é aplicado por um script inline no <head> (evita "piscar" o tema errado).
 */
import { $$ } from "./ui.js";
import { local } from "./utils.js";

const KEY = "megadavirada_tema";
const escuroNoSistema = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

/** Tema efetivo agora: "dark" ou "light". */
export function temaAtual() {
  const salvo = local.get(KEY);
  return salvo === "dark" || salvo === "light" ? salvo : escuroNoSistema() ? "dark" : "light";
}

function aplicar() {
  const salvo = local.get(KEY);
  if (salvo === "dark" || salvo === "light") document.documentElement.dataset.theme = salvo;
  else delete document.documentElement.dataset.theme;

  const escuro = temaAtual() === "dark";
  $$("[data-action='toggle-theme']").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(escuro));
    btn.setAttribute("aria-label", escuro ? "Desativar modo escuro" : "Ativar modo escuro");
    btn.title = escuro ? "Modo claro" : "Modo escuro";
    const icone = btn.querySelector("[data-theme-icon]");
    if (icone) icone.textContent = escuro ? "☀️" : "🌙";
    const rotulo = btn.querySelector("[data-theme-label]");
    if (rotulo) rotulo.textContent = escuro ? "Modo claro" : "Modo escuro";
  });
}

export function alternarTema() {
  local.set(KEY, temaAtual() === "dark" ? "light" : "dark");
  aplicar();
}

export function setupTema() {
  aplicar();
  // Sem escolha salva, acompanha a troca de tema do aparelho (ex.: modo escuro automático à noite)
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (!local.get(KEY)) aplicar();
  });
}
