import { html, render, pad2 } from "./utils.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// ---------- Navegação entre telas ----------

/** Mostra uma view e ajusta os botões do cabeçalho conforme o contexto (guest/user/admin). */
export function showView(id) {
  const target = document.getElementById(id);
  $$("[data-view]").forEach((v) => { v.hidden = v !== target; });
  const ctx = target?.dataset.view ?? "guest";
  $$("[data-show]").forEach((el) => { el.hidden = !el.dataset.show.split(" ").includes(ctx); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Toasts ----------

const ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };

export function toast(message, type = "info", { duration = 4500 } = {}) {
  if (!message) return;
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  render(el, html`<span aria-hidden="true">${ICONS[type] ?? ""}</span><span>${message}</span>
    <button class="toast__close" aria-label="Fechar">×</button>`);

  const close = () => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  el.querySelector("button").addEventListener("click", close);
  $("#toasts").append(el);
  setTimeout(close, type === "error" ? duration + 2500 : duration);
}

/** Exibe o resultado de uma chamada de API como toast. */
export function notify(res, successFallback = "Feito!") {
  if (res?.success) toast(res.message || successFallback, "success");
  else toast(res?.message || "Algo deu errado.", "error");
}

// ---------- Diálogos ----------

export function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
  return dialog;
}

export function closeDialog(target) {
  const dialog = typeof target === "string" ? document.getElementById(target) : target?.closest("dialog");
  dialog?.close();
}

/** Fecha o diálogo ao clicar no fundo escurecido. */
export function enableBackdropClose() {
  $$("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
}

/** Substituto moderno do confirm(): retorna Promise<boolean>. */
export function confirmDialog(message, { title = "Confirmar", okText = "Confirmar" } = {}) {
  const dialog = $("#dialog-confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-ok").textContent = okText;

  return new Promise((resolve) => {
    const onClick = (e) => {
      const btn = e.target.closest("[data-confirm]");
      if (btn) dialog.close(btn.dataset.confirm);
    };
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("close", () => {
      dialog.removeEventListener("click", onClick);
      resolve(dialog.returnValue === "true");
    }, { once: true });
    dialog.returnValue = "";
    dialog.showModal();
  });
}

// ---------- Botões com carregamento ----------

/** Desabilita o botão e mostra spinner enquanto a função assíncrona roda. */
export async function withLoading(button, fn) {
  if (!button) return fn();
  if (button.classList.contains("is-loading")) return undefined;
  button.classList.add("is-loading");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    button.classList.remove("is-loading");
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

// ---------- Bolinhas da loteria ----------

/**
 * @param {string[]} dezenas
 * @param {{ size?: ""|"sm"|"xs", variant?: ""|"muted"|"gold", slots?: number }} opts
 *   slots: completa com bolinhas vazias até esse total (seleção em andamento).
 */
export function balls(dezenas, { size = "", variant = "", slots = 0 } = {}) {
  const base = `ball${size ? ` ball--${size}` : ""}`;
  const vazias = Math.max(0, slots - dezenas.length);
  return html`<div class="balls">${dezenas.map((n) => html`<span class="${base}${variant ? ` ball--${variant}` : ""}">${n}</span>`)}${
    Array.from({ length: vazias }, () => html`<span class="${base} ball--empty" aria-hidden="true">–</span>`)}</div>`;
}

/** Card de um jogo. `extra` pode ser texto ou html`` (aparece à direita do rótulo). */
export function gameCard(dezenas, label, { extra = "", gold = false, ...opts } = {}) {
  return html`<div class="game${gold ? " game--gold" : ""}">
    <div class="game__label"><span>${label}</span>${extra}</div>
    ${balls(dezenas, { variant: gold ? "gold" : "", ...opts })}
  </div>`;
}

export const empty = (text) => html`<div class="empty">${text}</div>`;

// ---------- Volante (60 dezenas) ----------

export function buildPicker(container, onToggle) {
  container.innerHTML = Array.from({ length: 60 }, (_, i) =>
    `<button type="button" class="picker__num" data-num="${i + 1}" aria-pressed="false" aria-label="Dezena ${pad2(i + 1)}">${pad2(i + 1)}</button>`
  ).join("");
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-num]");
    if (btn && !btn.disabled) onToggle(Number(btn.dataset.num));
  });
}

export function updatePicker(container, selecionadas, max) {
  const cheio = selecionadas.length >= max;
  $$("[data-num]", container).forEach((btn) => {
    const on = selecionadas.includes(Number(btn.dataset.num));
    btn.setAttribute("aria-pressed", String(on));
    btn.disabled = cheio && !on;
  });
}

// ---------- Máscaras / calendário ----------

export function setupMasks({ phone, date }) {
  document.addEventListener("input", (e) => {
    const mask = e.target.dataset?.mask;
    if (mask === "phone") e.target.value = phone(e.target.value);
    if (mask === "date") e.target.value = date(e.target.value);
  });

  // Sincroniza o seletor nativo de data com o campo de texto
  document.addEventListener("change", (e) => {
    const forId = e.target.dataset?.proxyFor;
    if (!forId || !e.target.value) return;
    const [y, m, d] = e.target.value.split("-");
    document.getElementById(forId).value = `${d}/${m}/${y}`;
  });
}

export function openCalendar(targetId) {
  const proxy = $(`[data-proxy-for="${targetId}"]`);
  if (!proxy) return;
  try {
    if (typeof proxy.showPicker === "function") proxy.showPicker();
    else proxy.click();
  } catch {
    document.getElementById(targetId)?.focus();
  }
}
