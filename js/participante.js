import { api } from "./api.js";
import { COTA, EDICAO, JOGOS_POR_PARTICIPANTE as TOTAL_JOGOS, DEZENAS_POR_JOGO as DEZENAS } from "./config.js";
import { state, setUser, resetWizard, pagamentoInformado, marcarPagamentoInformado } from "./state.js";
import { $, $$, showView, toast, withLoading, openDialog, balls, gameCard, empty, buildPicker, updatePicker } from "./ui.js";
import * as convite from "./convite.js";
import {
  html, render, onlyDigits, pad2, firstName, formatPhone, formatBRL, toNumber, isValidBrDate,
  parseDezenas, completarAleatorio, indiceDuplicado, copyToClipboard, parseValorBRL,
} from "./utils.js";
import { gerarComprovante, gerarComprovanteCompleto } from "./pdf.js";
import { conferirJogos, descreverFaixas, lerSorteadas } from "./conferencia.js";

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

/**
 * Situação do pagamento do participante (pode pagar a cota em partes).
 * `valorPago`/`valorPendente` vêm do servidor; sem eles (Apps Script antigo), vale só o status.
 */
function situacaoPagamento(u = state.user) {
  const total = valores().total;
  if (isPago(u)) return { total, pago: total, falta: 0, parcial: false };
  const pago = Math.max(0, Number(u?.valorPago) || 0);
  const falta = u?.valorPendente !== undefined ? Math.max(0, Number(u.valorPendente) || 0) : Math.max(0, total - pago);
  return { total, pago, falta, parcial: pago > 0 && falta > 0 };
}

/**
 * Aviso de pagamento que o participante fez e o organizador ainda não conferiu.
 * informado: total já avisado; restante: quanto ainda falta avisar.
 */
function avisoPendente(u = state.user, sit = situacaoPagamento(u)) {
  if (isPago(u) || sit.falta <= 0) return { informado: 0, restante: 0, data: "" };
  if (u && "avisoPagamento" in u) { // Apps Script atualizado: o aviso fica na planilha
    const informado = Math.min(sit.falta, Number(u.avisoPagamento?.valor) || 0);
    return { informado, restante: Math.max(0, Math.round((sit.falta - informado) * 100) / 100), data: u.avisoPagamento?.data || "" };
  }
  // Apps Script antigo: só sabemos (neste aparelho) que avisou o valor inteiro
  const local = pagamentoInformado(u?.id, sit.pago);
  return { informado: local ? sit.falta : 0, restante: local ? 0 : sit.falta, data: "" };
}

const dataCurta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const prazoEncerrado = () => Date.now() >= new Date(EDICAO.prazoAlteracao).getTime();

/** Os jogos podem ser escolhidos/alterados enquanto o bolão estiver aberto e dentro do prazo. */
const podeAlterarJogos = () => !statusBolao().fechado && !prazoEncerrado();

/** Número do organizador (só dígitos, com 55 do Brasil) ou "" se não configurado. */
function whatsappOrganizador() {
  const d = onlyDigits(state.config?.whatsapp || state.publicConfig?.whatsapp || "");
  if (d.length < 10) return "";
  return d.length <= 11 ? `55${d}` : d;
}

/** Atualiza os botões "Tirar dúvidas" ([data-whatsapp]): link com mensagem pronta, ou escondidos. */
export function renderWhatsapp() {
  const numero = whatsappOrganizador();
  const nome = state.user?.name ? ` Sou ${firstName(state.user.name)}.` : "";
  const texto = `Olá!${nome} Tenho uma dúvida sobre o Bolão da Mega da Virada.`;
  $$("[data-whatsapp]").forEach((a) => {
    a.hidden = !numero;
    if (numero) a.href = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  });
  $$("[data-whatsapp-box]").forEach((el) => { el.hidden = !numero; });
}

/** Configuração pública (antes do login): por enquanto só o WhatsApp do organizador. */
export async function carregarConfigPublica() {
  const res = await api("getConfig");
  if (res.success) state.publicConfig = res;
  renderWhatsapp();
}

/** Preenche os valores da cota em todos os elementos [data-valor]. */
export function renderValores() {
  const v = valores();
  $$("[data-valor]").forEach((el) => { el.textContent = formatBRL(v[el.dataset.valor]); });
  $$("[data-edicao]").forEach((el) => { el.textContent = EDICAO[el.dataset.edicao]; });
  renderWhatsapp();
  convite.renderConvite(v.total);
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
  if (qtdJogos < TOTAL_JOGOS && podeAlterarJogos()) startWizard();
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

/**
 * O backend não informa o total de participantes, mas devolve todos os jogos do grupo
 * e cada participante salva exatamente 5. Conta quem já escolheu os jogos (inclusive você).
 */
function contarParticipantes(d) {
  const outros = Math.ceil(d.otherGames.length / TOTAL_JOGOS);
  return outros + (d.myGames.length > 0 ? 1 : 0);
}

export function renderDashboard() {
  const u = state.user;
  if (!u) return;
  const d = state.dashboard ?? { myGames: [], otherGames: [], bolaoGames: [] };
  const { fechado, registrado } = statusBolao();
  const pago = isPago(u);
  const sit = situacaoPagamento(u);
  const av = avisoPendente(u, sit);
  const informado = av.informado > 0 && av.restante <= 0; // avisou tudo o que faltava
  const carregado = Boolean(state.dashboard);

  renderValores();
  $("#dash-nome").textContent = firstName(u.name);
  $("#dash-telefone").textContent = formatPhone(u.phone);
  $("#dash-pagamento").textContent = pago ? "✅ Confirmado"
    : informado ? "⏳ Em conferência"
    : sit.parcial ? `Falta ${formatBRL(sit.falta)}`
    : "⏳ Pendente";
  $("#dash-participantes").textContent = carregado ? contarParticipantes(d) : "—";
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
      <p>Por causa da instabilidade do sistema das loterias em 30 e 31/12, os jogos serão registrados em <strong>${EDICAO.registroJogos}</strong>.</p></div></div>`);
  }

  if (carregado && !pago && fechado) {
    avisos.push(html`<div class="notice notice--danger"><span class="notice__icon" aria-hidden="true">⛔</span>
      <p><strong>Você não está participando</strong>: o pagamento da cota não foi ${sit.parcial ? `completado (faltaram ${formatBRL(sit.falta)})` : "confirmado"} antes do fechamento do bolão.</p></div>`);
  } else if (carregado && !pago) {
    avisos.push(html`<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">💰</span><div class="grow stack-sm">
      ${sit.parcial ? html`
        <div class="stack-sm">
          <p>Você já pagou <strong>${formatBRL(sit.pago)}</strong> de ${formatBRL(sit.total)}. <strong>Falta pagar ${formatBRL(sit.falta)}</strong>.</p>
          <div class="paybar" role="img" aria-label="${Math.round((sit.pago / sit.total) * 100)}% da cota pago"><span style="width:${Math.min(100, Math.round((sit.pago / sit.total) * 100))}%"></span></div>
        </div>` : ""}
      ${informado
        ? html`<p><strong>Pagamento informado!</strong> Você avisou que pagou ${formatBRL(av.informado)}${av.data ? ` (${dataCurta(av.data)})` : ""}. Aguardando o organizador conferir e dar baixa.</p>`
        : av.informado > 0
          ? html`<p>📨 Você avisou que pagou <strong>${formatBRL(av.informado)}</strong>${av.data ? ` em ${dataCurta(av.data)}` : ""} — aguardando a conferência do organizador.
              Ainda falta pagar <strong>${formatBRL(av.restante)}</strong> até ${EDICAO.prazoPagamento}.</p>`
          : sit.parcial
            ? html`<p>Pague o restante até <strong>${EDICAO.prazoPagamento}</strong> — em ${EDICAO.registroJogos} os jogos são registrados e o bolão é fechado.</p>`
            : html`<p>Seu pagamento de <strong>${formatBRL(valores().total)}</strong> ainda não foi feito ou confirmado.
              Pague até <strong>${EDICAO.prazoPagamento}</strong> — em ${EDICAO.registroJogos} os jogos são registrados e o bolão é fechado.
              Pode pagar tudo de uma vez ou em partes.</p>`}
      <div class="row row--wrap">
        <button class="btn btn--outline btn--sm" data-action="open-payment">Ver chave PIX</button>
        ${informado ? "" : html`
          <button class="btn btn--primary btn--sm" data-action="notify-payment">✓ ${av.informado || sit.parcial ? `Já paguei o restante (${formatBRL(av.restante)})` : "Já paguei via PIX"}</button>
          <button class="btn btn--outline btn--sm" data-action="notify-partial">💸 Paguei só uma parte</button>`}
      </div></div></div>`);
  }
  render($("#dash-avisos"), avisos);
  $("#dash-avisos").hidden = avisos.length === 0;

  // Meus jogos
  const editavel = carregado && podeAlterarJogos();
  $("#btn-comprovante").hidden = d.myGames.length === 0;
  $("#btn-editar-jogos").hidden = !(editavel && d.myGames.length > 0);
  const prazo = $("#dash-meus-prazo");
  prazo.hidden = !carregado || d.myGames.length === 0;
  prazo.textContent = editavel
    ? `✏️ Você pode alterar seus jogos até ${EDICAO.registroJogos}, quando o bolão fecha.`
    : "🔒 Prazo de alteração encerrado: seus jogos estão definitivos.";
  render($("#dash-meus-jogos"), d.myGames.length
    ? d.myGames.map((g, i) => gameCard(parseDezenas(g.dezenas), `Jogo ${g.gameNumber || i + 1}`, { size: "sm" }))
    : editavel
      ? html`<div class="empty stack-sm"><p>Você ainda não escolheu seus palpites.</p>
          <button class="btn btn--primary btn--sm" data-action="start-wizard">Escolher meus ${TOTAL_JOGOS} jogos</button></div>`
      : empty(carregado ? "Nenhum jogo cadastrado." : "Carregando…"));

  renderConferencia(carregado);

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

// ---------- Depois do fechamento: conferência e comprovante com todos os jogos ----------

/** Jogos que valem no bolão, como o participante os vê (os dele só se pagou). */
function jogosDoBolao() {
  const d = state.dashboard ?? { myGames: [], otherGames: [], bolaoGames: [] };
  const meusValem = isPago(state.user);
  return {
    meusValem,
    meus: [...d.myGames].sort((a, b) => a.gameNumber - b.gameNumber),
    oficiais: d.bolaoGames,
    outros: d.otherGames,
  };
}

function renderConferencia(carregado) {
  const { fechado } = statusBolao();
  const card = $("#dash-conferencia");
  card.hidden = !(carregado && fechado);
  if (card.hidden) return;
  const { meusValem, meus } = jogosDoBolao();
  $("#conf-meus-fora").hidden = meusValem || meus.length === 0;
}

export function conferirResultado(form) {
  const { sorteadas, erro } = lerSorteadas(form.elements.sorteadas.value);
  if (erro) return toast(erro, "error");

  const { meusValem, meus, oficiais, outros } = jogosDoBolao();
  const jogos = [
    ...(meusValem ? meus.map((g, i) => ({ dezenas: parseDezenas(g.dezenas), meu: true, label: `Seu jogo ${g.gameNumber || i + 1}` })) : []),
    ...oficiais.map((g, i) => {
      const dezenas = parseDezenas(g.dezenas);
      return { dezenas, oficial: true, label: `Jogo especial #${i + 1} · ${dezenas.length} dezenas` };
    }),
    ...outros.map((g, i) => ({ dezenas: parseDezenas(g.dezenas), label: `Jogo do grupo #${i + 1}` })),
  ];
  const { premiados, total } = conferirJogos(jogos, sorteadas);
  const meusPremiados = premiados.filter((j) => j.meu).length;

  const resultado = html`<p class="section-title">Resultado conferido</p>${balls([...sorteadas].sort(), { variant: "gold" })}`;
  render($("#conf-part-resultado"), premiados.length
    ? html`${resultado}
      <div class="notice notice--success"><span class="notice__icon" aria-hidden="true">🏆</span><div>
        <p><strong>${premiados.length} jogo(s) do bolão premiado(s)!</strong> Total: ${descreverFaixas(total)}.</p>
        ${meusPremiados ? html`<p>🎉 <strong>${meusPremiados === 1 ? "Um deles é seu!" : `${meusPremiados} deles são seus!`}</strong></p>` : ""}
        <p class="small muted">${jogos.length} jogos conferidos. Confira também o resultado oficial no site da Caixa.</p>
      </div></div>
      ${premiados.map((j) => gameCard(j.dezenas, j.label, {
        size: "sm",
        gold: j.oficial,
        hits: sorteadas,
        extra: html`<span class="badge ${j.acertos === 6 ? "badge--gold" : "badge--brand"}">${j.meu ? "⭐ " : ""}${j.acertos} acertos · ${descreverFaixas(j.faixas)}</span>`,
      }))}`
    : html`${resultado}
      <div class="notice"><span class="notice__icon" aria-hidden="true">🔎</span><div>
        <p><strong>Nenhum jogo com 4 ou mais acertos.</strong></p>
        <p class="small muted">${jogos.length} jogos conferidos. Confira também o resultado oficial no site da Caixa.</p>
      </div></div>`);
}

export function baixarTodosOsJogos() {
  if (!statusBolao().fechado) return toast("O comprovante com todos os jogos fica disponível depois do fechamento do bolão.", "info");
  const { meusValem, meus, oficiais, outros } = jogosDoBolao();
  try {
    gerarComprovanteCompleto({ user: state.user, meus, meusValem, oficiais, outros });
  } catch (e) {
    toast(e.message, "error");
  }
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

function avisoPrazo() {
  return statusBolao().fechado
    ? "O bolão está fechado: não é mais possível alterar os jogos."
    : `O prazo para escolher ou alterar os jogos terminou em ${EDICAO.registroJogos}.`;
}

export function startWizard() {
  if (!podeAlterarJogos()) return toast(avisoPrazo(), "error");
  resetWizard();
  $("#wizard-greeting").textContent =
    `Olá, ${firstName(state.user?.name)}! Escolha ${DEZENAS} dezenas para cada um dos seus ${TOTAL_JOGOS} jogos.`;
  showView("view-wizard");
  renderWizard();
}

/** Abre o volante já preenchido com os jogos salvos, para o participante alterar. */
export function editarJogos() {
  if (!podeAlterarJogos()) return toast(avisoPrazo(), "error");
  const salvos = [...(state.dashboard?.myGames ?? [])].sort((a, b) => a.gameNumber - b.gameNumber);
  if (!salvos.length) return startWizard();

  resetWizard();
  state.wizard.editando = true;
  salvos.slice(0, TOTAL_JOGOS).forEach((g, i) => {
    state.wizard.games[i] = parseDezenas(g.dezenas).map(Number).sort((a, b) => a - b);
  });
  $("#wizard-greeting").textContent =
    `Toque nas dezenas para trocar os números. Você pode alterar até ${EDICAO.registroJogos}.`;
  showView("view-wizard");
  renderWizard();
}

/** Sai da edição sem salvar. */
export function cancelarEdicao() {
  resetWizard();
  irParaPainel();
  toast("Alteração cancelada. Seus jogos continuam os mesmos.", "info");
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
  const { step, games, editando } = state.wizard;
  const jogo = jogoAtual();

  $("#wizard-secao").textContent = editando ? "Alterar meus jogos" : "Seus palpites";
  $("#btn-cancelar-edicao").hidden = !editando;
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
  const { editando } = state.wizard;
  render($("#review-list"), state.wizard.games.map((g, i) => gameCard(g.map(pad2), `Jogo ${i + 1}`, {
    extra: html`<button type="button" class="btn btn--link xsmall" data-action="go-game" data-index="${i}">✏️ Alterar</button>`,
  })));
  $("#review-titulo").textContent = editando ? "Revise as alterações" : `Revise seus ${TOTAL_JOGOS} jogos`;
  $("[data-action='submit-games']").textContent = editando ? "✅ Salvar alterações" : "✅ Confirmar e ir para o pagamento";
  $("#btn-cancelar-revisao").hidden = !editando;
  showView("view-review");
}

export const voltarAoWizard = () => irParaJogo(state.wizard.step);

export async function enviarJogos(button) {
  if (!validarTodos()) return;
  if (!podeAlterarJogos()) return toast(avisoPrazo(), "error");
  const { editando } = state.wizard;
  const res = await withLoading(button, () =>
    api("saveGames", { participantId: state.user.id, games: state.wizard.games }));
  if (!res.success) return toast(res.message, "error");

  resetWizard();
  if (editando) {
    toast("Seus jogos foram alterados!", "success");
    await refreshDashboard();
    return irParaPainel();
  }

  toast(res.message || "Seus jogos foram salvos!", "success");
  fimDoCadastro = true; // ao sair do pagamento, oferece o convite para amigos
  await refreshDashboard();
  await abrirPagamento();
}

// ---------- Pagamento PIX ----------

function pixAtual() {
  const c = state.config ?? {};
  return { chave: String(c.pixKey ?? "").trim(), tipo: c.pixTipo || "Chave PIX", titular: c.pixNome || "", banco: String(c.pixBanco ?? "").trim() };
}

export async function abrirPagamento() {
  // A chave vem da planilha: garante que a configuração foi carregada antes de exibir.
  if (!state.config) await refreshDashboard();
  const pix = pixAtual();
  renderValores();
  $("#pay-pix").value = pix.chave || "Não foi possível carregar a chave. Toque em ↻ Atualizar no painel.";
  $("#pay-pix-label").textContent = `Chave PIX (${pix.tipo})`;
  $("#pay-titular").textContent = [pix.titular && `Titular: ${pix.titular}`, pix.banco && `Instituição: ${pix.banco}`].filter(Boolean).join(" · ");
  $("[data-action='copy-pix']").disabled = !pix.chave;

  const pago = isPago(state.user);
  const sit = situacaoPagamento();
  const av = avisoPendente(state.user, sit);
  const informado = av.informado > 0 && av.restante <= 0;
  const { fechado } = statusBolao();

  // Pagamento em partes: mostra quanto falta em vez do valor cheio da cota
  $("#pay-preco-label").textContent = sit.parcial ? "Falta pagar" : "Valor da cota";
  $("#pay-preco").textContent = formatBRL(sit.parcial ? sit.falta : sit.total);
  $("#pay-parcial").hidden = !sit.parcial;
  $("#pay-parcial").textContent = sit.parcial
    ? `Você já pagou ${formatBRL(sit.pago)} de ${formatBRL(sit.total)}. Faça o PIX de ${formatBRL(sit.falta)} para completar a cota.`
    : "";
  const pendente = !pago && !informado && !fechado;
  $("#pay-confirmar").hidden = !pendente;
  $("#pay-confirmar").textContent = av.informado || sit.parcial
    ? `👉 Já paguei o restante (${formatBRL(av.restante)}), avisar o organizador`
    : "👉 Já paguei, avisar o organizador";
  $("#pay-parcial-btn").hidden = !pendente;
  $("#pay-depois").hidden = !pendente;
  $("#pay-depois-hint").hidden = !pendente;
  $("#pay-voltar").hidden = pendente;
  $("#pay-status").hidden = !(pago || av.informado > 0);
  $("#pay-status").textContent = pago
    ? "✅ Seu pagamento já foi confirmado pelo organizador."
    : informado
      ? "⏳ Pagamento informado — aguardando a conferência do organizador."
      : `📨 Você avisou que pagou ${formatBRL(av.informado)} — aguardando a conferência. Ainda falta ${formatBRL(av.restante)}.`;
  showView("view-payment");
}

/** "Pagar depois": volta ao painel (onde o PIX continua disponível até o prazo). */
export function pagarDepois() {
  toast(`Tudo bem! Você pode pagar pelo seu painel até ${EDICAO.prazoPagamento}.`, "info");
  irParaPainel();
}

export async function copiarPix() {
  const { chave } = pixAtual();
  if (!chave) return toast("Chave PIX indisponível no momento.", "error");
  const ok = await copyToClipboard(chave);
  toast(ok ? "Chave PIX copiada!" : "Não foi possível copiar. Selecione e copie manualmente.", ok ? "success" : "error");
}

/** Envia o aviso de pagamento ao organizador (sem valor = tudo o que falta). */
async function enviarAviso(button, valor) {
  const res = await withLoading(button, () =>
    api("confirmPayment", { participantId: state.user.id, ...(valor ? { valor } : {}) }));
  if (!res.success) {
    toast(res.message, "error");
    return false;
  }
  if ("avisoPagamento" in res) setUser({ ...state.user, avisoPagamento: res.avisoPagamento });
  else if (!valor) marcarPagamentoInformado(state.user.id, situacaoPagamento().pago); // Apps Script antigo
  toast(res.message || "Pagamento informado! O organizador vai conferir.", "success");
  return true;
}

export async function avisarPagamento(button) {
  if (await enviarAviso(button)) irParaPainel();
}

/** "Paguei só uma parte": abre a janela para o participante informar quanto pagou. */
export function abrirPagamentoParcial() {
  const av = avisoPendente();
  if (av.restante <= 0) return toast("Você já informou todo o valor. Aguarde a conferência do organizador.", "info");
  const form = $("#form-pag-parcial");
  form.reset();
  form.elements.valor.placeholder = "Ex.: 20,00";
  $("#parcial-info").textContent = av.informado
    ? `Você já avisou ${formatBRL(av.informado)}. Ainda falta pagar ${formatBRL(av.restante)}.`
    : `Falta pagar ${formatBRL(av.restante)} da sua cota. Informe quanto você transferiu agora — o organizador confere no extrato e registra.`;
  openDialog("dialog-pag-parcial");
  form.elements.valor.focus();
}

export async function informarPagamentoParcial(form) {
  const { restante } = avisoPendente();
  const valor = parseValorBRL(form.elements.valor.value);
  if (!(valor > 0)) return toast("Informe o valor que você pagou, por exemplo 20,00.", "error");
  if (valor > restante) return toast(`O valor é maior do que falta pagar (${formatBRL(restante)}).`, "error");
  if (!(await enviarAviso(form.querySelector('[type="submit"]'), valor))) return;
  form.closest("dialog")?.close();
  irParaPainel();
}

let fimDoCadastro = false;

export function irParaPainel() {
  renderDashboard();
  showView("view-dashboard");
  if (fimDoCadastro) {
    fimDoCadastro = false;
    openDialog("dialog-convite");
  }
}

// ---------- Convite ----------

export const convidarWhatsApp = () => convite.compartilharWhatsApp(valores().total);
export const convidarApp = () => convite.compartilharApp(valores().total);
export const copiarConvite = () => convite.copiarConvite(valores().total);
