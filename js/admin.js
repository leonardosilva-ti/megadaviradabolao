import { api } from "./api.js";
import { COTA, DEZENAS_POR_JOGO, JOGOS_POR_PARTICIPANTE, TAMANHOS_JOGO_OFICIAL } from "./config.js";
import { state, setAdminPassword, clearSession } from "./state.js";
import { $, $$, showView, toast, notify, withLoading, confirmDialog, openDialog, gameCard, balls, empty, buildPicker, updatePicker } from "./ui.js";
import { html, render, onlyDigits, pad2, formatPhone, formatBRL, toNumber, parseDezenas, completarAleatorio, downloadFile } from "./utils.js";
import { gerarListaCompleta } from "./pdf.js";

const isPago = (p) => String(p?.paymentStatus ?? "").toLowerCase() === "pago";
const senha = () => state.adminPassword;
const dados = () => state.admin.data ?? { participants: [], bolaoGames: [], config: {} };

// ---------- Login / carregamento ----------

export async function adminLogin(form) {
  const password = form.elements.password.value.trim();
  if (!password) return toast("Informe a senha do organizador.", "error");

  const button = form.querySelector('[type="submit"]');
  const res = await withLoading(button, () => api("adminLogin", { password }));
  if (!res.success) return toast(res.message, "error");

  setAdminPassword(password);
  form.reset();
  await withLoading(button, () => carregarAdmin());
}

/** Carrega o painel. Retorna true se deu certo. */
export async function carregarAdmin(button) {
  if (!senha()) return false;
  const res = await withLoading(button, () => api("adminGetData", { password: senha() }));
  if (!res.success) {
    toast(res.message, "error");
    if (/autorizad|senha/i.test(res.message ?? "")) sair(); // senha trocada na planilha
    return false;
  }

  state.admin.data = {
    participants: res.participants ?? [],
    bolaoGames: res.bolaoGames ?? [],
    config: res.config ?? {},
  };
  renderTudo();
  showView("view-admin");
  if (button) toast("Dados atualizados!", "success");
  return true;
}

export function sair() {
  clearSession();
  showView("view-admin-login");
}

function renderTudo() {
  renderStatus();
  renderMetricas();
  renderTabela();
  renderOficiais();
  renderConfig();
  renderSeletorJogo();
  renderAvisoConferencia();
}

// ---------- Status do bolão ----------

function statusBolao() {
  const c = dados().config;
  return { fechado: c.StatusBolao === "Fechado", registrado: c.RegistroLoteria === true || c.RegistroLoteria === "true" };
}

function renderStatus() {
  const { fechado, registrado } = statusBolao();
  render($("#adm-status"), html`
    <span class="badge ${fechado ? "badge--danger" : "badge--brand"}">${fechado ? "🔒 Fechado" : "🟢 Aberto"}</span>
    <span class="badge ${registrado ? "badge--brand" : "badge--warn"}">${registrado ? "✅ Registrado na loteria" : "⏳ Aguardando registro"}</span>`);
  $("[data-action='close-bolao']").hidden = fechado;
  $("[data-action='open-bolao']").hidden = !fechado;
  $("[data-action='confirm-lottery']").hidden = registrado;
}

async function alterarStatus(button, action, mensagem, opts) {
  if (!(await confirmDialog(mensagem, opts))) return;
  const res = await withLoading(button, () => api(action, { password: senha() }));
  notify(res);
  if (!res.success) return;
  const cfg = dados().config;
  if (res.StatusBolao) cfg.StatusBolao = res.StatusBolao;
  if (res.RegistroLoteria) cfg.RegistroLoteria = res.RegistroLoteria;
  renderStatus();
  renderAvisoConferencia();
}

export const fecharBolao = (el) => alterarStatus(el, "adminCloseBolao",
  "Novos cadastros e avisos de pagamento serão bloqueados. Quem não pagou deixa de participar. O status de registro na loteria não muda.",
  { title: "Fechar o bolão?", okText: "Fechar bolão" });

export const reabrirBolao = (el) => alterarStatus(el, "adminOpenBolao",
  "Novos cadastros e avisos de pagamento serão liberados novamente.",
  { title: "Reabrir o bolão?", okText: "Reabrir" });

export const confirmarLoteria = (el) => alterarStatus(el, "adminConfirmLottery",
  "Isso marca os jogos como registrados na loteria, fecha o bolão e avisa todos os participantes no painel.",
  { title: "Confirmar registro na loteria?", okText: "Confirmar registro" });

// ---------- Métricas ----------

function valores() {
  const total = toNumber(dados().config.valorTotal, COTA.total);
  const jogos = JOGOS_POR_PARTICIPANTE * COTA.precoAposta;
  return { total, fundo: Math.max(0, total - jogos) };
}

function renderMetricas() {
  const { participants, bolaoGames } = dados();
  const pagos = participants.filter(isPago).length;
  const v = valores();
  $("#m-total").textContent = participants.length;
  $("#m-pagos").textContent = pagos;
  $("#m-pendentes").textContent = participants.length - pagos;
  $("#m-arrecadado").textContent = formatBRL(pagos * v.total);
  $("#m-fundo").textContent = formatBRL(pagos * v.fundo);
  $("#m-jogos").textContent = participants.filter(isPago).reduce((t, p) => t + (p.gamesCount || 0), 0) + bolaoGames.length;
  $("#m-fundo-label").textContent = `Fundo (${formatBRL(v.fundo)}/cota)`;
  $("#adm-qtd").textContent = `${participants.length} cadastrado(s)`;
}

// ---------- Participantes ----------

export function renderTabela() {
  const busca = $("#adm-busca").value.trim().toLowerCase();
  const buscaDigitos = onlyDigits(busca);
  const filtro = $("#adm-filtro").value;

  const lista = dados().participants.filter((p) => {
    if (filtro === "pago" && !isPago(p)) return false;
    if (filtro === "pendente" && isPago(p)) return false;
    if (!busca) return true;
    return String(p.name).toLowerCase().includes(busca) || (buscaDigitos && onlyDigits(p.phone).includes(buscaDigitos));
  });

  render($("#adm-tabela"), lista.length
    ? lista.map((p) => {
      const pago = isPago(p);
      const completo = (p.gamesCount || 0) >= JOGOS_POR_PARTICIPANTE;
      return html`<tr>
        <td style="min-width:170px"><strong>${p.name}</strong><br><span class="xsmall muted" style="white-space:nowrap">${formatPhone(p.phone)}</span></td>
        <td>${p.birthdate || "—"}</td>
        <td><span class="badge ${completo ? "badge--brand" : ""}">${p.gamesCount || 0} de ${JOGOS_POR_PARTICIPANTE}</span></td>
        <td><span class="badge ${pago ? "badge--brand" : "badge--warn"}">${pago ? "Pago" : "Pendente"}</span></td>
        <td><div class="actions">
          <button class="btn btn--sm ${pago ? "btn--outline" : "btn--primary"}" data-action="toggle-payment" data-id="${p.id}" data-status="${pago ? "Pendente" : "Pago"}">
            ${pago ? "↩ Voltar p/ pendente" : "✓ Dar baixa"}</button>
          <button class="btn btn--ghost btn--sm" data-action="view-games" data-id="${p.id}">👁️ Jogos</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--danger)" data-action="delete-participant" data-id="${p.id}" aria-label="Excluir ${p.name}">🗑️ Excluir</button>
        </div></td>
      </tr>`;
    })
    : html`<tr><td colspan="5" class="center muted">Nenhum participante encontrado.</td></tr>`);
}

export async function alternarPagamento(button) {
  const { id, status } = button.dataset;
  const p = dados().participants.find((x) => x.id === id);
  if (!p) return;
  if (status === "Pendente" && !(await confirmDialog(`Voltar o pagamento de ${p.name} para pendente?`, { title: "Desfazer baixa", okText: "Voltar p/ pendente" }))) return;

  const res = await withLoading(button, () => api("adminUpdatePayment", { password: senha(), participantId: id, status }));
  if (!res.success) return toast(res.message, "error");
  p.paymentStatus = status;
  toast(status === "Pago" ? `Baixa registrada para ${p.name}.` : `${p.name} voltou para pendente.`, "success");
  renderMetricas();
  renderTabela();
}

export async function excluirParticipante(button) {
  const id = button.dataset.id;
  const p = dados().participants.find((x) => x.id === id);
  if (!p) return;
  const jogos = p.gamesCount || 0;
  const aviso = `${p.name} (${formatPhone(p.phone)}) será removido do bolão${jogos ? ` junto com ${jogos} jogo(s)` : ""}.`
    + `${isPago(p) ? " Atenção: o pagamento desta pessoa já está confirmado." : ""} Essa ação não pode ser desfeita.`;
  if (!(await confirmDialog(aviso, { title: "Excluir participante?", okText: "Excluir participante" }))) return;

  const res = await withLoading(button, () => api("adminDeleteParticipant", { password: senha(), participantId: id }));
  if (!res.success) return toast(res.message, "error");
  toast(res.message || `${p.name} foi excluído.`, "success");
  state.admin.data.participants = dados().participants.filter((x) => x.id !== id);
  renderMetricas();
  renderTabela();
}

export function verJogos(button) {
  const p = dados().participants.find((x) => x.id === button.dataset.id);
  if (!p) return;
  $("#jogos-titulo").textContent = `Jogos de ${p.name}`;
  const jogos = [...(p.games ?? [])].sort((a, b) => (a.jogoNumero ?? a.gameNumber) - (b.jogoNumero ?? b.gameNumber));
  render($("#jogos-lista"), jogos.length
    ? jogos.map((g, i) => gameCard(parseDezenas(g.dezenas), `Jogo ${g.jogoNumero ?? g.gameNumber ?? i + 1}`, { size: "sm" }))
    : empty("Este participante ainda não cadastrou jogos."));
  openDialog("dialog-jogos");
}

// ---------- Jogos oficiais (6 a 9 dezenas) ----------

export function setupSeletorJogo() {
  buildPicker($("#adm-picker"), alternarDezena);
  render($("#adm-tamanhos"), TAMANHOS_JOGO_OFICIAL.map((n) =>
    html`<button type="button" class="tabs__btn" role="tab" data-action="game-size" data-size="${n}">${n > DEZENAS_POR_JOGO ? "⭐ " : ""}${n} dezenas</button>`));
}

export function definirTamanho(el) {
  const tamanho = Number(el.dataset.size);
  state.admin.tamanho = tamanho;
  state.admin.selecionadas = state.admin.selecionadas.slice(0, tamanho);
  renderSeletorJogo();
}

function alternarDezena(n) {
  const { selecionadas, tamanho } = state.admin;
  const i = selecionadas.indexOf(n);
  if (i !== -1) selecionadas.splice(i, 1);
  else if (selecionadas.length >= tamanho) return toast(`Limite de ${tamanho} dezenas para este formato.`, "info");
  else selecionadas.push(n);
  selecionadas.sort((a, b) => a - b);
  renderSeletorJogo();
}

function renderSeletorJogo() {
  const { selecionadas, tamanho } = state.admin;
  const isSuper = tamanho > DEZENAS_POR_JOGO;
  $$("#adm-tamanhos [data-size]").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.size) === tamanho)));
  $("#adm-contador").textContent = `${selecionadas.length} de ${tamanho} dezenas marcadas`;
  render($("#adm-selecao"), balls(selecionadas.map(pad2), { slots: tamanho, variant: isSuper ? "gold" : "" }));
  $("#adm-picker").classList.toggle("picker--gold", isSuper);
  updatePicker($("#adm-picker"), selecionadas, tamanho);
  $("[data-action='save-official']").disabled = selecionadas.length !== tamanho;
}

export function surpresinha() {
  const { selecionadas, tamanho } = state.admin;
  if (selecionadas.length >= tamanho) return toast("Todas as dezenas já foram marcadas.", "info");
  state.admin.selecionadas = completarAleatorio(selecionadas, tamanho);
  renderSeletorJogo();
}

export function limparSelecao() {
  state.admin.selecionadas = [];
  renderSeletorJogo();
}

export async function salvarJogoOficial(button) {
  const { selecionadas, tamanho } = state.admin;
  if (selecionadas.length !== tamanho) return toast(`Marque exatamente ${tamanho} dezenas.`, "error");

  const repetido = dados().bolaoGames.some((g) => parseDezenas(g.dezenas).join(",") === selecionadas.map(pad2).join(","));
  if (repetido && !(await confirmDialog("Já existe um jogo oficial com exatamente essas dezenas. Cadastrar mesmo assim?", { title: "Jogo repetido" }))) return;

  const res = await withLoading(button, () => api("adminAddGame", { password: senha(), dezenas: selecionadas }));
  if (!res.success) return toast(res.message, "error");
  toast(res.message || "Jogo oficial cadastrado!", "success");
  if (res.game) dados().bolaoGames.push(res.game);
  limparSelecao();
  renderOficiais();
  renderMetricas();
  trocarAba("oficiais");
}

function renderOficiais() {
  const jogos = dados().bolaoGames;
  $("#adm-oficiais-qtd").textContent = jogos.length;
  render($("#adm-oficiais"), jogos.length
    ? jogos.map((g, i) => {
      const dezenas = parseDezenas(g.dezenas);
      return gameCard(dezenas, `Jogo oficial #${i + 1} · ${dezenas.length} dezenas`, {
        size: "sm",
        gold: dezenas.length > DEZENAS_POR_JOGO,
        extra: html`<button class="btn btn--link xsmall" style="color:var(--danger)" data-action="delete-official" data-id="${g.id}">🗑️ Excluir</button>`,
      });
    })
    : empty("Nenhum jogo oficial ainda. Use a aba “Novo jogo oficial” para cadastrar jogos de 6 a 9 dezenas."));
}

export async function excluirJogoOficial(button) {
  if (!(await confirmDialog("Excluir este jogo oficial do bolão?", { title: "Excluir jogo", okText: "Excluir" }))) return;
  const id = button.dataset.id;
  const res = await withLoading(button, () => api("adminDeleteGame", { password: senha(), gameId: id }));
  if (!res.success) return toast(res.message, "error");
  toast(res.message || "Jogo excluído.", "success");
  state.admin.data.bolaoGames = dados().bolaoGames.filter((g) => String(g.id) !== id);
  renderOficiais();
  renderMetricas();
}

// ---------- Exportação (TXT para registrar na loteria / PDF) ----------

/**
 * Junta os jogos dos participantes (do backend) com os jogos oficiais do bolão.
 * Por padrão só entram participantes com pagamento confirmado.
 */
async function coletarJogos(button) {
  const res = await withLoading(button, () => api("adminExportAllJSON", { password: senha() }));
  if (!res.success) {
    toast(res.message, "error");
    return null;
  }
  const incluirPendentes = $("#exp-pendentes").checked;
  const participantes = (res.games ?? [])
    .filter((g) => incluirPendentes || isPago(g))
    .map((g) => ({ ...g, oficial: false }));
  const oficiais = dados().bolaoGames.map((g) => ({
    participantName: `Bolão · ${parseDezenas(g.dezenas).length} dezenas`, dezenas: g.dezenas, oficial: true,
  }));
  const jogos = [...oficiais, ...participantes];
  if (!jogos.length) {
    toast(incluirPendentes ? "Nenhum jogo cadastrado para exportar." : "Nenhum jogo de participante pago para exportar.", "error");
    return null;
  }
  return jogos;
}

export async function exportarTxt(button) {
  const jogos = await coletarJogos(button);
  if (!jogos) return;
  downloadFile("jogos_loteria.txt", jogos.map((g) => parseDezenas(g.dezenas).join(",")).join("\n"));
  toast(`${jogos.length} jogo(s) exportado(s) para TXT.`, "success");
}

export async function exportarPdf(button) {
  const jogos = await coletarJogos(button);
  if (!jogos) return;
  try {
    gerarListaCompleta(jogos);
    toast(`PDF gerado com ${jogos.length} jogo(s).`, "success");
  } catch (e) {
    toast(e.message, "error");
  }
}

// ---------- Conferência do resultado ----------

const comb = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

/**
 * Quantas apostas de 6 dezenas premiadas um jogo de `n` dezenas com `acertos` equivale.
 * Ex.: jogo de 8 dezenas com 5 acertos = 3 quinas + 15 quadras.
 */
function faixas(n, acertos) {
  return {
    sena: comb(acertos, 6),
    quina: comb(acertos, 5) * comb(n - acertos, 1),
    quadra: comb(acertos, 4) * comb(n - acertos, 2),
  };
}

const descreverFaixas = (f) => [
  f.sena && `${f.sena} sena${f.sena > 1 ? "s" : ""}`,
  f.quina && `${f.quina} quina${f.quina > 1 ? "s" : ""}`,
  f.quadra && `${f.quadra} quadra${f.quadra > 1 ? "s" : ""}`,
].filter(Boolean).join(" + ");

export function renderAvisoConferencia() {
  $("#conf-aviso").hidden = statusBolao().fechado;
}

export function conferir(form) {
  const nums = form.elements.sorteadas.value.split(/[^\d]+/).filter(Boolean).map(Number);
  if (nums.length !== 6) return toast("Informe exatamente as 6 dezenas sorteadas.", "error");
  if (nums.some((n) => n < 1 || n > 60)) return toast("As dezenas devem estar entre 01 e 60.", "error");
  if (new Set(nums).size !== 6) return toast("Há dezenas repetidas no resultado.", "error");

  const sorteadas = new Set(nums.map(pad2));
  const { participants, bolaoGames } = dados();

  // Jogos efetivamente registrados: os oficiais + os de quem pagou.
  const jogos = [
    ...bolaoGames.map((g, i) => {
      const dezenas = parseDezenas(g.dezenas);
      return { dezenas, oficial: true, label: `Jogo oficial #${i + 1} · ${dezenas.length} dezenas` };
    }),
    ...participants.filter(isPago).flatMap((p) => (p.games ?? []).map((g, i) => ({
      dezenas: parseDezenas(g.dezenas), oficial: false,
      label: `${p.name} · Jogo ${g.jogoNumero ?? g.gameNumber ?? i + 1}`,
    }))),
  ];

  const premiados = jogos
    .map((j) => {
      const acertos = j.dezenas.filter((d) => sorteadas.has(d)).length;
      return { ...j, acertos, faixas: faixas(j.dezenas.length, acertos) };
    })
    .filter((j) => j.acertos >= 4)
    .sort((a, b) => b.acertos - a.acertos || b.dezenas.length - a.dezenas.length);

  const total = premiados.reduce((t, j) => ({
    sena: t.sena + j.faixas.sena, quina: t.quina + j.faixas.quina, quadra: t.quadra + j.faixas.quadra,
  }), { sena: 0, quina: 0, quadra: 0 });

  const resultado = html`<p class="section-title">Resultado conferido</p>${balls([...sorteadas].sort(), { variant: "gold" })}`;

  render($("#conf-resultado"), premiados.length
    ? html`${resultado}
      <div class="notice notice--success"><span class="notice__icon" aria-hidden="true">🏆</span><div>
        <p><strong>${premiados.length} jogo(s) premiado(s)!</strong> Total: ${descreverFaixas(total)}.</p>
        <p class="small muted">${jogos.length} jogos conferidos (oficiais + participantes com pagamento confirmado).</p>
      </div></div>
      ${premiados.map((j) => gameCard(j.dezenas, j.label, {
        size: "sm",
        gold: j.oficial,
        hits: sorteadas,
        extra: html`<span class="badge ${j.acertos === 6 ? "badge--gold" : "badge--brand"}">${j.acertos} acertos · ${descreverFaixas(j.faixas)}</span>`,
      }))}`
    : html`${resultado}
      <div class="notice"><span class="notice__icon" aria-hidden="true">🔎</span><div>
        <p><strong>Nenhum jogo com 4 ou mais acertos.</strong></p>
        <p class="small muted">${jogos.length} jogos conferidos (oficiais + participantes com pagamento confirmado).</p>
      </div></div>`);
}

// ---------- Configuração do PIX ----------

function renderConfig() {
  const c = dados().config;
  const form = $("#form-adm-pix");
  form.elements.pixKey.value = c.pixKey || "";
  form.elements.pixTipo.value = c.pixTipo || "E-mail";
  form.elements.pixNome.value = c.pixNome || "";
  form.elements.notificationEmail.value = c.notificationEmail || "";
}

export async function salvarPix(form) {
  const payload = {
    pixKey: form.elements.pixKey.value.trim(),
    pixTipo: form.elements.pixTipo.value,
    pixNome: form.elements.pixNome.value.trim(),
    notificationEmail: form.elements.notificationEmail.value.trim(),
  };
  if (!payload.pixKey) return toast("Informe a chave PIX.", "error");
  if (payload.notificationEmail && !form.elements.notificationEmail.checkValidity()) return toast("E-mail de notificação inválido.", "error");

  const res = await withLoading(form.querySelector('[type="submit"]'), () => api("adminSavePixConfig", { password: senha(), ...payload }));
  notify(res, "Configurações salvas!");
  if (res.success) Object.assign(dados().config, payload, res.config ?? {});
}

// ---------- Abas ----------

export function trocarAba(nome) {
  $$("[data-action='tab']").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === nome)));
  $$("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== nome; });
}
