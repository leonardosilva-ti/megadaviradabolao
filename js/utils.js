// ---------- HTML seguro ----------

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marca uma string como HTML confiável (não será escapada). */
export const raw = (value) => new SafeHtml(String(value));

function renderValue(value) {
  if (value == null || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escapeHtml(value);
}

/** Template literal que escapa automaticamente todos os valores interpolados. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += renderValue(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

export function render(el, content) {
  el.innerHTML = renderValue(content);
}

// ---------- Texto / números ----------

export const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
export const pad2 = (n) => String(n).padStart(2, "0");
export const firstName = (name) => String(name ?? "").trim().split(/\s+/)[0] || "participante";

export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatDateMask(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** Valida uma data "DD/MM/AAAA" real, no passado e depois de 1900. */
export function isValidBrDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [dd, mm, yyyy] = m.slice(1).map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd &&
    date < new Date() && yyyy > 1900;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (value) => BRL.format(Number(value) || 0);

/** Converte "45.00", "45,00" ou 45 em número (ou o fallback). */
export function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : fallback;
}

/** "04, 12, 23" | [4, 12, 23] -> ["04", "12", "23"] */
export function parseDezenas(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[^\d]+/);
  return list.filter((n) => String(n).trim() !== "").map((n) => pad2(Number(n)));
}

/** Gera dezenas aleatórias completando a seleção atual até `total`. */
export function completarAleatorio(atuais, total) {
  const set = new Set(atuais);
  while (set.size < total) set.add(1 + Math.floor(Math.random() * 60));
  return [...set].sort((a, b) => a - b);
}

/** Retorna o índice de um jogo idêntico ao jogo `index` (ou -1). */
export function indiceDuplicado(jogos, index) {
  const alvo = jogos[index].join(",");
  return jogos.findIndex((j, i) => i !== index && j.length === jogos[index].length && j.join(",") === alvo);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores sem Clipboard API (ou contexto não seguro)
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Armazenamento ----------

function makeStorage(getArea) {
  return {
    get(key) {
      try {
        const value = getArea().getItem(key);
        if (value == null) return null;
        try { return JSON.parse(value); } catch { return value; } // compatível com valores antigos não-JSON
      } catch { return null; }
    },
    set(key, value) { try { getArea().setItem(key, JSON.stringify(value)); } catch { /* indisponível */ } },
    remove(key) { try { getArea().removeItem(key); } catch { /* indisponível */ } },
  };
}

/** Persiste entre visitas (sessão do participante). */
export const local = makeStorage(() => localStorage);
/** Some ao fechar a aba (senha do admin). */
export const session = makeStorage(() => sessionStorage);
