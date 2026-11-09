import { api } from "./api.js";
import { COTA, EDICAO, JOGOS_POR_PARTICIPANTE as TOTAL_JOGOS, DEZENAS_POR_JOGO as DEZENAS } from "./config.js";
import { state, setUser, resetWizard, pagamentoInformado, marcarPagamentoInformado } from "./state.js";
import { $, $$, showView, toast, withLoading, balls, gameCard, empty, buildPicker, updatePicker } from "./ui.js";
import {
  html, render, onlyDigits, pad2, firstName, formatPhone, formatBRL, toNumber, isValidBrDate,
  parseDezenas, completarAleatorio, indiceDuplicado, copyToClipboard,
} from "./utils.js";
import { gerarComprovante } from "./pdf.js";

const submitBtn = (form) => form.querySelector('[type="submit"]');
const isPago = (u) => String(u?.paymentStatus ?? "").toLowerCase() === "pago";

// ---------- Regras / configuração vinda da planilha ----------

export function valores() {
  const total = toNumber(state.config?.valorTotal, COTA.total);
  const jogos = TOTAL_JOGOS * COTA.precoAposta;
  return { total, jogos, fundo: Math.max(0, total - jogos) };
}

function statusBolao() {
  const c = state.config ?? {};
  return {
    fechado: c.StatusBolao === "Fechado",
    registrado: c.RegistroLoteria === true || c.RegistroLoteria === "true",
  };
}

/** Preenche os valores da cota em todos os elementos [data-valor]. */
export function renderValores() {
  const v = valores();
  $$("[data-valor]").forEach((el) => { el.textContent = formatBRL(v[el.dataset.valor]); });
}

// ---------- Login / cadastro ----------

export async function login(form) {
  const phone = onlyDigits(form.elements.phone.value);
  const birthdate = form.elements.birthdate.value.trim();
  if (phone.length < 10) return toast("Informe o celular com DDD.", "error");
  if (!isValidBrDate(birthdate)) return toast("Data de nascimento inválida. Use o formato DD/MM/AAAA.", "error");

  const res = await withLoading(submitBtn(form), () => api("login", { phone, birthdate }));
  if (res.notFound) {
    $("#reg-phone").value = formatPhone(phone);
    $("#reg-birthdate").value = birthdate;
    showView("view-register");
    return toast("Não encontramos seu cadastro. Confira as regras e cadastre-se!", "info");
  }
  if (!res.success) return toast(res.message, "error");

  form.reset();
  await entrar(res.user, `Bem-vindo(a) de volta, ${firstName(res.user.name)}!`);
}

export async function register(form) {
  const name = form.elements.name.value.trim().replace(/\s+/g, " ");
  const phone = onlyDigits(form.elements.phone.value);
  const birthdate = form.elements.birthdate.value.trim();

  if (name.length < 3 || !name.includes(" ")) return toast("Informe seu nome completo (nome e sobrenome).", "error");
  if (phone.length < 10) return toast("Informe o celular com DDD.", "error");
  if (!isValidBrDate(birthdate)) return toast("Data de nascimento inválida. Use o formato DD/MM/AAAA.", "error");
  if (!form.elements.terms.checked) return toast("Você precisa ler e aceitar as regras do bolão para continuar.", "error");

  const res = await withLoading(submitBtn(form), () => api("register", { name, phone, birthdate }));
  if (!res.success) return toast(res.message, "error");

  form.reset();
  await entrar(res.user, `Cadastro realizado, ${firstName(res.user.name)}!`);
}

async function entrar(user, mensagem) {
  setUser(user);
  state.dashboard = null;
  state.config = null;
  toast(mensagem, "success");
  await abrirPainelOuWizard();
}

/** Após login (ou ao reabrir o site): vai para o wizard se ainda faltam os jogos, senão para o painel. */
export async function abrirPainelOuWizard() {
  renderDashboard();
  showView("view-dashboard");
  const ok = await refreshDashboard();
  const qtdJogos = ok ? state.dashboard.myGames.length : (state.user.hasGames ? TOTAL_JOGOS : 0);
  if (qtdJogos < TOTAL_JOGOS && !statusBolao().fechado) startWizard();
}

// ---------- Painel ----------

/** Recarrega os dados do painel. Retorna true se deu certo. */
export async function refreshDashboard(button) {
  if (!state.user?.id) return false;
  const res = await withLoading(button, () => api("getDashboardData", { participantId: state.user.id }));
  if (!res.success) {
    toast(res.message || "Não foi possível carregar seus dados.", "error");
    return false;
  }
  state.dashboard = {
    ...res,
    myGames: res.myGames ?? [],
    otherGames: res.otherGames ?? [],
    bolaoGames: res.bolaoGames ?? [],
  };
  state.config = res.config ?? {};
  setUser({ ...state.user, ...res.user, hasGames: state.dashboard.myGames.length >= TOTAL_JOGOS });
  renderDashboard();
  if (button) toast("Dados atualizados!", "success");
  return true;
}

export function renderDashboard() {
  const u = state.user;
  if (!u) return;
  const d = state.dashboard ?? { myGames: [], otherGames: [], bolaoGames: [] };
  const { fechado, registrado } = statusBolao();
  const pago = isPago(u);
  const informado = pagamentoInformado(u.id);
  const carregado = Boolean(state.dashboard);

  renderValores();
  $("#dash-nome").textContent = firstName(u.name);
  $("#dash-telefone").textContent = formatPhone(u.phone);
  $("#dash-pagamento").textContent = pago ? "✅ Confirmado" : informado ? "⏳ Em conferência" : "⏳ Pendente";
  $("#dash-qtd-jogos").textContent = `${d.myGames.length} de ${TOTAL_JOGOS}`;
  $("#dash-status").textContent = !carregado ? "—" : registrado ? "Registrado" : fechado ? "Fechado" : "Aberto";

  // Avisos
  const avisos = [];
  if (registrado) {
    avisos.push(html`<div class="notice notice--success"><span class="notice__icon" aria-hidden="true">✅</span><div>
      <p><strong>Jogos registrados na loteria!</strong></p>
      <p>Os jogos do bolão foram registrados oficialmente. Boa sorte a todos no dia ${EDICAO.dataSorteio}!</p></div></div>`);
  } else if (fechado) {
    avisos.push(html`<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">⏳</span><div>
      <p><strong>Bolão fechado — aguardando o registro na loteria.</strong></p>
      <p>Por causa da instabilidade do sistema das loterias em 30 e 31/12, os jogos serão registrados em <strong>${EDICAO.dataRegistro}</strong>.</p></div></div>`);
  }

  if (carregado && !pago && fechado) {
    avisos.push(html`<div class="notice notice--danger"><span class="notice__icon" aria-hidden="true">⛔</span>
      <p><strong>Você não está participando</strong>: o pagamento da cota não foi confirmado antes do fechamento do bolão.</p></div>`);
  } else if (carregado && !pago) {
    avisos.push(html`<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">💰</span><div class="grow stack-sm">
      ${informado
        ? html`<p><strong>Pagamento informado!</strong> Aguardando o organizador conferir e dar baixa.</p>`
        : html`<p>Seu pagamento de <strong>${formatBRL(valores().total)}</strong> ainda não foi confirmado pelo organizador.</p>`}
      <div class="row row--wrap">
        <button class="btn btn--outline btn--sm" data-action="open-payment">Ver chave PIX</button>
        ${informado ? "" : html`<button class="btn btn--primary btn--sm" data-action="notify-payment">✓ Já paguei via PIX</button>`}
      </div></div></div>`);
  }
  render($("#dash-avisos"), avisos);
  $("#dash-avisos").hidden = avisos.length === 0;

  // Meus jogos
  $("#btn-comprovante").hidden = d.myGames.length === 0;
  render($("#dash-meus-jogos"), d.myGames.length
    ? d.myGames.map((g, i) => gameCard(parseDezenas(g.dezenas), `Jogo ${g.gameNumber || i + 1}`, { size: "sm" }))
    : carregado && !fechado
      ? html`<div class="empty stack-sm"><p>Você ainda não escolheu seus palpites.</p>
          <button class="btn btn--primary btn--sm" data-action="start-wizard">Escolher meus ${TOTAL_JOGOS} jogos</button></div>`
      : empty(carregado ? "Nenhum jogo cadastrado." : "Carregando…"));

  // Jogos especiais do bolão
  render($("#dash-oficiais"), d.bolaoGames.length
    ? d.bolaoGames.map((g, i) => {
      const dezenas = parseDezenas(g.dezenas);
      const isSuper = dezenas.length > DEZENAS;
      return gameCard(dezenas, `Jogo oficial #${i + 1} · ${dezenas.length} dezenas`, {
        size: "sm", gold: isSuper, extra: isSuper ? html`<span class="badge badge--gold">★ Super aposta</span>` : "",
      });
    })
    : empty("Nenhum jogo especial ainda. Assim que as cotas forem confirmadas, o organizador registra os jogos aqui."));

  // Jogos do grupo (anônimos)
  $("#dash-outros-qtd").textContent = d.otherGames.length;
  render($("#dash-outros"), d.otherGames.length
    ? d.otherGames.map((g, i) => gameCard(parseDezenas(g.dezenas), `#${i + 1}`, { size: "xs", variant: "muted" }))
    : html`<p class="small muted">Ainda não há jogos de outros participantes.</p>`);
}

export function baixarComprovante() {
  const jogos = state.dashboard?.myGames ?? [];
  if (!jogos.length) return toast("Você ainda não cadastrou seus palpites.", "error");
  try {
    gerarComprovante(state.user, jogos);
  } catch (e) {
    toast(e.message, "error");
  }
}

// ---------- Wizard dos 5 jogos ----------

export function setupWizard() {
  buildPicker($("#picker"), alternarDezena);
  render($("#wizard-steps"), Array.from({ length: TOTAL_JOGOS }, (_, i) =>
    html`<button type="button" class="steps__item" data-action="go-game" data-index="${i}">Jogo ${i + 1}</button>`));
}

export function startWizard() {
  if (statusBolao().fechado) return toast("O bolão está fechado para novos jogos.", "error");
  resetWizard();
  $("#wizard-greeting").textContent =
    `Olá, ${firstName(state.user?.name)}! Escolha ${DEZENAS} dezenas para cada um dos seus ${TOTAL_JOGOS} jogos.`;
  showView("view-wizard");
  renderWizard();
}

const jogoAtual = () => state.wizard.games[state.wizard.step];

function alternarDezena(n) {
  const jogo = jogoAtual();
  const i = jogo.indexOf(n);
  if (i !== -1) jogo.splice(i, 1);
  else if (jogo.length >= DEZENAS) return toast(`Você já marcou ${DEZENAS} dezenas. Desmarque uma para trocar.`, "info");
  else jogo.push(n);
  jogo.sort((a, b) => a - b);
  renderWizard();
}

function renderWizard() {
  const { step, games } = state.wizard;
  const jogo = jogoAtual();

  $$("#wizard-steps .steps__item").forEach((el, i) => {
    el.classList.toggle("is-current", i === step);
    el.classList.toggle("is-done", i !== step && games[i].length === DEZENAS);
    el.setAttribute("aria-current", i === step ? "step" : "false");
  });
  $("#wizard-titulo").textContent = `Jogo ${step + 1} de ${TOTAL_JOGOS}`;
  $("#wizard-contador").textContent = `${jogo.length} de ${DEZENAS} dezenas marcadas`;
  render($("#wizard-selecao"), balls(jogo.map(pad2), { slots: DEZENAS }));
  updatePicker($("#picker"), jogo, DEZENAS);

  $("#btn-prev-game").hidden = step === 0;
  const next = $("#btn-next-game");
  const ultimo = step === TOTAL_JOGOS - 1;
  next.textContent = ultimo ? "Revisar meus jogos →" : `Próximo: jogo ${step + 2} →`;
  next.classList.toggle("btn--primary", ultimo);
  next.classList.toggle("btn--info", !ultimo);
  next.disabled = jogo.length !== DEZENAS;
}

export function surpresinha() {
  const jogo = jogoAtual();
  const faltam = DEZENAS - jogo.length;
  if (faltam <= 0) return toast("Este jogo já tem todas as dezenas.", "info");
  state.wizard.games[state.wizard.step] = completarAleatorio(jogo, DEZENAS);
  renderWizard();
  toast(jogo.length ? `Surpresinha completou ${faltam} dezena(s).` : `${DEZENAS} dezenas geradas pela surpresinha!`, "info");
}

export function limparJogo() {
  state.wizard.games[state.wizard.step] = [];
  renderWizard();
}

export function irParaJogo(index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= TOTAL_JOGOS) return;
  state.wizard.step = i;
  showView("view-wizard");
  renderWizard();
}

export function jogoAnterior() {
  if (state.wizard.step > 0) irParaJogo(state.wizard.step - 1);
}

export function proximoJogo() {
  const { step, games } = state.wizard;
  if (jogoAtual().length !== DEZENAS) return toast(`Marque ${DEZENAS} dezenas antes de continuar.`, "error");
  const dup = indiceDuplicado(games, step);
  if (dup !== -1) return toast(`Este jogo é idêntico ao Jogo ${dup + 1}. Escolha uma combinação diferente.`, "error");

  if (step < TOTAL_JOGOS - 1) irParaJogo(step + 1);
  else mostrarRevisao(); // valida todos e volta ao primeiro jogo incompleto, se houver
}

function validarTodos() {
  const { games } = state.wizard;
  const incompleto = games.findIndex((g) => g.length !== DEZENAS);
  if (incompleto !== -1) {
    toast(`O Jogo ${incompleto + 1} está incompleto.`, "error");
    irParaJogo(incompleto);
    return false;
  }
  for (let i = 0; i < games.length; i++) {
    const dup = indiceDuplicado(games, i);
    if (dup !== -1) {
      toast(`O Jogo ${i + 1} e o Jogo ${dup + 1} são idênticos. Diferencie os palpites.`, "error");
      irParaJogo(dup);
      return false;
    }
  }
  return true;
}

function mostrarRevisao() {
  if (!validarTodos()) return;
  render($("#review-list"), state.wizard.games.map((g, i) => gameCard(g.map(pad2), `Jogo ${i + 1}`, {
    extra: html`<button type="button" class="btn btn--link xsmall" data-action="go-game" data-index="${i}">✏️ Alterar</button>`,
  })));
  showView("view-review");
}

export const voltarAoWizard = () => irParaJogo(state.wizard.step);

export async function enviarJogos(button) {
  if (!validarTodos()) return;
  const res = await withLoading(button, () =>
    api("saveGames", { participantId: state.user.id, games: state.wizard.games }));
  if (!res.success) return toast(res.message, "error");

  toast(res.message || "Seus jogos foram salvos!", "success");
  resetWizard();
  await refreshDashboard();
  await abrirPagamento();
}

// ---------- Pagamento PIX ----------

function pixAtual() {
  const c = state.config ?? {};
  return { chave: String(c.pixKey ?? "").trim(), tipo: c.pixTipo || "Chave PIX", titular: c.pixNome || "" };
}

export async function abrirPagamento() {
  // A chave vem da planilha: garante que a configuração foi carregada antes de exibir.
  if (!state.config) await refreshDashboard();
  const pix = pixAtual();
  renderValores();
  $("#pay-pix").value = pix.chave || "Não foi possível carregar a chave. Toque em ↻ Atualizar no painel.";
  $("#pay-pix-label").textContent = `Chave PIX (${pix.tipo})`;
  $("#pay-titular").textContent = pix.titular ? `Titular: ${pix.titular}` : "";
  $("[data-action='copy-pix']").disabled = !pix.chave;

  const pago = isPago(state.user);
  const { fechado } = statusBolao();
  $("#pay-confirmar").hidden = pago || fechado || pagamentoInformado(state.user.id);
  $("#pay-status").hidden = !(pago || pagamentoInformado(state.user.id));
  $("#pay-status").textContent = pago
    ? "✅ Seu pagamento já foi confirmado pelo organizador."
    : "⏳ Pagamento informado — aguardando a conferência do organizador.";
  showView("view-payment");
}

export async function copiarPix() {
  const { chave } = pixAtual();
  if (!chave) return toast("Chave PIX indisponível no momento.", "error");
  const ok = await copyToClipboard(chave);
  toast(ok ? "Chave PIX copiada!" : "Não foi possível copiar. Selecione e copie manualmente.", ok ? "success" : "error");
}

export async function avisarPagamento(button) {
  const res = await withLoading(button, () => api("confirmPayment", { participantId: state.user.id }));
  if (!res.success) return toast(res.message, "error");
  marcarPagamentoInformado(state.user.id);
  toast(res.message || "Pagamento informado! O organizador vai conferir.", "success");
  renderDashboard();
  showView("view-dashboard");
}

export function irParaPainel() {
  renderDashboard();
  showView("view-dashboard");
}
