import { api } from "./api.js";
import { COTA, DEZENAS_POR_JOGO, JOGOS_POR_PARTICIPANTE, TAMANHOS_JOGO_OFICIAL } from "./config.js";
import { state, setAdminToken, clearSession } from "./state.js";
import { $, $$, showView, toast, notify, withLoading, confirmDialog, openDialog, gameCard, balls, empty, buildPicker, updatePicker } from "./ui.js";
import { html, render, onlyDigits, pad2, formatPhone, formatBRL, toNumber, parseDezenas, completarAleatorio, downloadFile } from "./utils.js";
import { gerarListaCompleta } from "./pdf.js";
import { conferirJogos, descreverFaixas, lerSorteadas } from "./conferencia.js";

const isPago = (p) => String(p?.paymentStatus ?? "").toLowerCase() === "pago";
/** Passe assinado do painel (a senha só é usada no login). */
const sessao = () => state.adminToken;
const dados = () => state.admin.data ?? { participants: [], bolaoGames: [], config: {} };

// ---------- Login / carregamento ----------

export async function adminLogin(form) {
  const password = form.elements.password.value.trim();
  if (!password) return toast("Informe a senha do organizador.", "error");

  const button = form.querySelector('[type="submit"]');
  const res = await withLoading(button, () => api("adminLogin", { password }));
  if (!res.success) return toast(res.message, "error");

  if (!res.token) return toast("Atualize o code.gs no Apps Script (nova versão) para usar o painel.", "error");
  setAdminToken(res.token); // guarda só o passe, nunca a senha
  form.reset();
  await withLoading(button, () => carregarAdmin());
}

/** Carrega o painel. Retorna true se deu certo. */
export async function carregarAdmin(button) {
  if (!sessao()) return false;
  const res = await withLoading(button, () => api("adminGetData", { token: sessao() }));
  if (!res.success) {
    if (!res.sessaoExpirada) toast(res.message, "error"); // passe vencido: o aviso vem do evento "sessao-expirada"
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
  marcados.clear();
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
  const res = await withLoading(button, () => api(action, { token: sessao() }));
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
  // Soma o que entrou de fato, inclusive pagamentos parciais
  $("#m-arrecadado").textContent = formatBRL(participants.reduce((t, p) => t + resumoPagamento(p).pago, 0));
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

  // Descarta da seleção quem não existe mais (excluído ou recarregado)
  const existentes = new Set(dados().participants.map((p) => p.id));
  for (const id of marcados) if (!existentes.has(id)) marcados.delete(id);
  visiveis = lista.map((p) => p.id);

  render($("#adm-tabela"), lista.length
    ? lista.map((p) => {
      const pago = isPago(p);
      const completo = (p.gamesCount || 0) >= JOGOS_POR_PARTICIPANTE;
      const marcado = marcados.has(p.id);
      return html`<tr class="${marcado ? "is-selected" : ""}">
        <td class="col-check"><input type="checkbox" class="row-check" data-select="${p.id}" aria-label="Selecionar ${p.name}" ${marcado ? "checked" : ""}></td>
        <td style="min-width:170px"><strong>${p.name}</strong><br><span class="xsmall muted" style="white-space:nowrap">${formatPhone(p.phone)}</span></td>
        <td>${p.birthdate || "—"}</td>
        <td><span class="badge ${completo ? "badge--brand" : ""}">${p.gamesCount || 0} de ${JOGOS_POR_PARTICIPANTE}</span></td>
        <td>${celulaPagamento(p)}</td>
        <td><div class="actions">
          <button class="btn btn--sm ${pago ? "btn--outline" : "btn--primary"}" data-action="toggle-payment" data-id="${p.id}" data-status="${pago ? "Pendente" : "Pago"}">
            ${pago ? "↩ Voltar p/ pendente" : "✓ Dar baixa"}</button>
          <button class="btn btn--ghost btn--sm" data-action="open-payments" data-id="${p.id}" title="Lançar valor pago (pagamento em partes)">💵 Valores</button>
          <button class="btn btn--ghost btn--sm" data-action="view-games" data-id="${p.id}">👁️ Jogos</button>
          <button class="btn btn--ghost btn--sm btn--trash" data-action="delete-participant" data-id="${p.id}" aria-label="Excluir ${p.name}" title="Excluir participante">${ICONE_LIXEIRA}</button>
        </div></td>
      </tr>`;
    })
    : html`<tr><td colspan="6" class="center muted">Nenhum participante encontrado.</td></tr>`);
  renderSelecao();
}

// ---------- Seleção múltipla (dar baixa / excluir em lote) ----------

const marcados = new Set();
let visiveis = [];

const ICONE_LIXEIRA = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const participantesMarcados = () => dados().participants.filter((p) => marcados.has(p.id));

function renderSelecao() {
  const todos = $("#adm-check-todos");
  const qtdVisiveisMarcados = visiveis.filter((id) => marcados.has(id)).length;
  todos.checked = visiveis.length > 0 && qtdVisiveisMarcados === visiveis.length;
  todos.indeterminate = qtdVisiveisMarcados > 0 && qtdVisiveisMarcados < visiveis.length;
  todos.disabled = visiveis.length === 0;

  const sel = participantesMarcados();
  const pendentes = sel.filter((p) => !isPago(p)).length;
  $("#adm-lote").hidden = sel.length === 0;
  $("#adm-lote-qtd").textContent = `${sel.length} selecionado(s)`;
  const baixa = $("[data-action='bulk-pay']");
  baixa.disabled = pendentes === 0;
  baixa.textContent = pendentes ? `✓ Dar baixa (${pendentes})` : "✓ Todos já pagos";
  $("[data-action='bulk-delete']").textContent = `Excluir (${sel.length})`;
}

export function marcarParticipante(input) {
  const id = input.dataset.select;
  if (input.checked) marcados.add(id); else marcados.delete(id);
  input.closest("tr")?.classList.toggle("is-selected", input.checked);
  renderSelecao();
}

export function marcarTodos(input) {
  visiveis.forEach((id) => (input.checked ? marcados.add(id) : marcados.delete(id)));
  renderTabela();
}

export function desmarcarTodos() {
  marcados.clear();
  renderTabela();
}

/** "Ana, Bruno, Carla e mais 4" */
function listarNomes(lista, max = 5) {
  const nomes = lista.slice(0, max).map((p) => p.name);
  return lista.length > max ? `${nomes.join(", ")} e mais ${lista.length - max}` : nomes.join(", ");
}

/**
 * Chama a ação em lote; se o Apps Script publicado ainda não a conhecer,
 * faz uma chamada por participante com a ação individual.
 * Retorna { res, feitos } — `feitos` são os IDs efetivamente processados.
 */
async function executarEmLote(acaoLote, acaoUnica, ids, extra = {}) {
  const res = await api(acaoLote, { token: sessao(), participantIds: ids, ...extra });
  if (res.success) return { res, feitos: res.participantIds ?? ids };
  if (!/não reconhecida/i.test(res.message ?? "")) return { res, feitos: [] };

  const feitos = [];
  for (const id of ids) {
    const r = await api(acaoUnica, { token: sessao(), participantId: id, ...extra });
    if (!r.success) return { res: r, feitos };
    feitos.push(id);
  }
  return { res: { success: true }, feitos };
}

export async function darBaixaEmLote(button) {
  const alvo = participantesMarcados().filter((p) => !isPago(p));
  if (!alvo.length) return toast("Todos os selecionados já estão pagos.", "info");
  if (!(await confirmDialog(`Registrar o pagamento de ${alvo.length} participante(s): ${listarNomes(alvo)}?`,
    { title: "Dar baixa em lote", okText: `Dar baixa (${alvo.length})` }))) return;

  const ids = alvo.map((p) => p.id);
  const { res, feitos } = await withLoading(button, () => executarEmLote("adminUpdatePaymentBulk", "adminUpdatePayment", ids, { status: "Pago" }));
  const ok = new Set(feitos);
  dados().participants.forEach((p) => {
    if (!ok.has(p.id)) return;
    p.paymentStatus = "Pago";
    p.avisoPagamento = null;
    if (res.pagamentos?.[p.id]) p.pagamentos = res.pagamentos[p.id];
  });
  if (res.success) marcados.clear(); // concluído: começa uma seleção nova
  else feitos.forEach((id) => marcados.delete(id)); // deixa marcados só os que faltaram
  if (res.success) toast(`Baixa registrada para ${feitos.length} participante(s).`, "success");
  else toast(`${feitos.length ? `${feitos.length} de ${ids.length} receberam baixa. ` : ""}${res.message}`, "error");
  renderMetricas();
  renderTabela();
}

export async function excluirEmLote(button) {
  const alvo = participantesMarcados();
  if (!alvo.length) return;
  const pagos = alvo.filter(isPago).length;
  const jogos = alvo.reduce((t, p) => t + (p.gamesCount || 0), 0);
  const aviso = `Serão removidos do bolão ${alvo.length} participante(s)${jogos ? ` e ${jogos} jogo(s)` : ""}: ${listarNomes(alvo)}.`
    + `${pagos ? ` Atenção: ${pagos} já com pagamento confirmado.` : ""} Essa ação não pode ser desfeita.`;
  if (!(await confirmDialog(aviso, { title: `Excluir ${alvo.length} participante(s)?`, okText: `Excluir (${alvo.length})` }))) return;

  const ids = alvo.map((p) => p.id);
  const { res, feitos } = await withLoading(button, () => executarEmLote("adminDeleteParticipants", "adminDeleteParticipant", ids));
  const removidos = new Set(feitos);
  state.admin.data.participants = dados().participants.filter((p) => !removidos.has(p.id));
  feitos.forEach((id) => marcados.delete(id));
  if (res.success) toast(`${feitos.length} participante(s) excluído(s).`, "success");
  else toast(`${feitos.length ? `${feitos.length} de ${ids.length} foram excluídos. ` : ""}${res.message}`, "error");
  renderMetricas();
  renderTabela();
}

export async function alternarPagamento(button) {
  const { id, status } = button.dataset;
  const p = dados().participants.find((x) => x.id === id);
  if (!p) return;
  if (status === "Pendente" && !(await confirmDialog(`Voltar o pagamento de ${p.name} para pendente? O valor registrado na baixa (quitação) é removido; os valores parciais lançados continuam.`, { title: "Desfazer baixa", okText: "Voltar p/ pendente" }))) return;

  const res = await withLoading(button, () => api("adminUpdatePayment", { token: sessao(), participantId: id, status }));
  if (!res.success) return toast(res.message, "error");
  p.paymentStatus = status;
  if (res.pagamentos) p.pagamentos = res.pagamentos;
  if (status === "Pago") p.avisoPagamento = null;
  toast(status === "Pago" ? `Baixa registrada para ${p.name}.` : `${p.name} voltou para pendente.`, "success");
  renderMetricas();
  renderTabela();
}

// ---------- Valores pagos (pagamento em partes) ----------

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Quanto o participante já pagou e quanto falta. Mesmo cálculo do code.gs:
 * quem está "Pago" sem lançamentos (baixa antiga) conta como cota inteira.
 */
function resumoPagamento(p) {
  const cota = valores().total;
  const soma = money((p.pagamentos ?? []).reduce((t, x) => t + (Number(x.valor) || 0), 0));
  const pago = isPago(p);
  const valorPago = pago && soma < cota ? cota : soma;
  return { cota, pago: valorPago, falta: pago ? 0 : money(Math.max(0, cota - soma)), parcial: !pago && soma > 0 };
}

function celulaPagamento(p) {
  const r = resumoPagamento(p);
  if (isPago(p)) return html`<span class="badge badge--brand">Pago</span>`;
  const aviso = p.avisoPagamento?.valor
    ? html`<button type="button" class="aviso-pag" data-action="open-payments" data-id="${p.id}" title="Conferir e lançar o valor informado">
        📨 informou ${formatBRL(p.avisoPagamento.valor)}${p.avisoPagamento.parcial ? " (parcial)" : ""}</button>`
    : "";
  if (r.parcial) {
    return html`<span class="badge badge--info">Parcial</span>
      <div class="xsmall muted" style="margin-top:4px;white-space:nowrap">${formatBRL(r.pago)} de ${formatBRL(r.cota)}<br>falta <strong>${formatBRL(r.falta)}</strong></div>${aviso}`;
  }
  return html`<span class="badge badge--warn">Pendente</span>${aviso}`;
}

/** "R$ 1.234,56", "25,5", "25.50" → número. */
function lerValor(texto) {
  let t = String(texto ?? "").replace(/[^\d,.]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? money(n) : NaN;
}

let pagamentosDe = null; // id do participante aberto no diálogo

export function abrirPagamentos(button) {
  const p = dados().participants.find((x) => x.id === button.dataset.id);
  if (!p) return;
  pagamentosDe = p.id;
  const form = $("#form-pagamento");
  form.reset();
  renderPagamentos();
  const informado = Math.min(Number(p.avisoPagamento?.valor) || 0, resumoPagamento(p).falta);
  if (informado > 0) form.elements.valor.value = formatBRL(informado).replace(/^R\$\s*/, "");
  openDialog("dialog-pagamentos");
  if (!form.hidden) form.elements.valor.focus();
}

function renderPagamentos() {
  const p = dados().participants.find((x) => x.id === pagamentosDe);
  if (!p) return;
  const r = resumoPagamento(p);
  const pct = r.cota ? Math.min(100, Math.round((r.pago / r.cota) * 100)) : 0;

  $("#pag-titulo").textContent = `Valores de ${p.name}`;
  render($("#pag-resumo"), html`
    <div class="paybar" role="img" aria-label="${pct}% da cota pago"><span style="width:${pct}%"></span></div>
    <dl style="margin:0">
      <div class="kv"><dt>Valor da cota</dt><dd>${formatBRL(r.cota)}</dd></div>
      <div class="kv"><dt>Já pago</dt><dd class="text-brand">${formatBRL(r.pago)}</dd></div>
      <div class="kv"><dt>Falta pagar</dt><dd style="color:${r.falta ? "var(--warn)" : "inherit"}">${formatBRL(r.falta)}</dd></div>
    </dl>`);

  const form = $("#form-pagamento");
  form.hidden = r.falta <= 0;
  form.elements.valor.placeholder = formatBRL(r.falta);
  $("#pag-quitado").hidden = r.falta > 0;
  const aviso = !isPago(p) && p.avisoPagamento?.valor ? p.avisoPagamento : null;
  $("#pag-aviso").hidden = !aviso;
  if (aviso) {
    const quando = new Date(aviso.data);
    $("#pag-aviso-texto").textContent = `${p.name.split(" ")[0]} avisou que pagou ${formatBRL(aviso.valor)}`
      + `${aviso.parcial ? " (pagamento parcial)" : ""}`
      + `${Number.isNaN(quando.getTime()) ? "" : ` em ${quando.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}.`
      + " Confira no extrato e lance o valor abaixo (já preenchido).";
  }

  const lista = [...(p.pagamentos ?? [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const quando = (d) => { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
  render($("#pag-historico"), lista.length
    ? lista.map((x) => html`<li class="pay-item">
        <div><strong>${formatBRL(x.valor)}</strong> <span class="badge ${x.tipo === "Quitação" ? "badge--brand" : "badge--info"}">${x.tipo || "Parcial"}</span>
          <div class="xsmall muted">${quando(x.data)}${x.obs ? ` · ${x.obs}` : ""}</div></div>
        <button type="button" class="btn btn--ghost btn--sm btn--trash" data-action="delete-payment" data-id="${x.id}" aria-label="Remover lançamento de ${formatBRL(x.valor)}" title="Remover lançamento">${ICONE_LIXEIRA}</button>
      </li>`)
    : html`<li class="xsmall muted">${isPago(p) ? "Baixa feita sem valores lançados (cota inteira)." : "Nenhum valor lançado ainda."}</li>`);
}

/** Atualiza o participante com a resposta do servidor e redesenha tudo que depende dele. */
function aplicarRespostaPagamento(p, res) {
  if (res.paymentStatus) p.paymentStatus = res.paymentStatus;
  if (res.pagamentos) p.pagamentos = res.pagamentos;
  if ("avisoPagamento" in res) p.avisoPagamento = res.avisoPagamento;
  renderPagamentos();
  renderMetricas();
  renderTabela();
}

export async function lancarPagamento(form) {
  const p = dados().participants.find((x) => x.id === pagamentosDe);
  if (!p) return;
  const { falta } = resumoPagamento(p);
  const valor = lerValor(form.elements.valor.value || falta);
  if (!(valor > 0)) return toast("Informe um valor válido, por exemplo 20,00.", "error");
  if (valor > falta) return toast(`O valor é maior que o pendente (${formatBRL(falta)}).`, "error");

  const res = await withLoading(form.querySelector('[type="submit"]'), () => api("adminAddPayment", {
    token: sessao(), participantId: p.id, valor, observacao: form.elements.observacao.value.trim(),
  }));
  if (!res.success) {
    const antigo = /não reconhecida/i.test(res.message ?? "");
    return toast(antigo ? "Atualize o code.gs no Apps Script (nova versão) para lançar valores parciais." : res.message, "error");
  }
  form.reset();
  toast(res.message || "Pagamento lançado.", "success");
  aplicarRespostaPagamento(p, res);
}

export async function removerPagamento(button) {
  const p = dados().participants.find((x) => x.id === pagamentosDe);
  const item = p?.pagamentos?.find((x) => x.id === button.dataset.id);
  if (!p || !item) return;
  // A confirmação abre por cima do diálogo de valores (os dois ficam na camada superior).
  if (!(await confirmDialog(`Remover o lançamento de ${formatBRL(item.valor)} de ${p.name}? Se o total ficar abaixo da cota, o pagamento volta para pendente.`,
    { title: "Remover lançamento", okText: "Remover" }))) return;

  const res = await withLoading(button, () => api("adminDeletePayment", { token: sessao(), paymentId: item.id }));
  if (!res.success) return toast(res.message, "error");
  toast(res.message || "Lançamento removido.", "success");
  aplicarRespostaPagamento(p, res);
}

export async function excluirParticipante(button) {
  const id = button.dataset.id;
  const p = dados().participants.find((x) => x.id === id);
  if (!p) return;
  const jogos = p.gamesCount || 0;
  const aviso = `${p.name} (${formatPhone(p.phone)}) será removido do bolão${jogos ? ` junto com ${jogos} jogo(s)` : ""}.`
    + `${isPago(p) ? " Atenção: o pagamento desta pessoa já está confirmado." : ""} Essa ação não pode ser desfeita.`;
  if (!(await confirmDialog(aviso, { title: "Excluir participante?", okText: "Excluir participante" }))) return;

  const res = await withLoading(button, () => api("adminDeleteParticipant", { token: sessao(), participantId: id }));
  if (!res.success) return toast(res.message, "error");
  toast(res.message || `${p.name} foi excluído.`, "success");
  state.admin.data.participants = dados().participants.filter((x) => x.id !== id);
  marcados.delete(id);
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

  const res = await withLoading(button, () => api("adminAddGame", { token: sessao(), dezenas: selecionadas }));
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
  const res = await withLoading(button, () => api("adminDeleteGame", { token: sessao(), gameId: id }));
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
  const res = await withLoading(button, () => api("adminExportAllJSON", { token: sessao() }));
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

export function renderAvisoConferencia() {
  $("#conf-aviso").hidden = statusBolao().fechado;
}

export function conferir(form) {
  const { sorteadas, erro } = lerSorteadas(form.elements.sorteadas.value);
  if (erro) return toast(erro, "error");
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

  const { premiados, total } = conferirJogos(jogos, sorteadas);

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
  form.elements.pixBanco.value = c.pixBanco || "";
  form.elements.whatsapp.value = formatPhone(c.whatsapp || "");
  form.elements.notificationEmail.value = c.notificationEmail || "";
  form.elements.valorTotal.value = formatBRL(valores().total).replace(/^R\$\s*/, "");
  atualizarDivisaoCota();
}

/** Mostra como a cota digitada se divide entre os 5 jogos e o fundo do grupo. */
export function atualizarDivisaoCota() {
  const total = lerValor($("#cfg-valor").value);
  const jogos = JOGOS_POR_PARTICIPANTE * COTA.precoAposta;
  $("#cfg-valor-divisao").textContent = total >= jogos
    ? `${formatBRL(jogos)} pagam os 5 jogos do participante e ${formatBRL(total - jogos)} vão para o fundo dos jogos de 7, 8 e 9 dezenas.`
    : `A cota precisa ser de pelo menos ${formatBRL(jogos)} (5 jogos de ${formatBRL(COTA.precoAposta)}).`;
}

export async function salvarPix(form) {
  const payload = {
    pixKey: form.elements.pixKey.value.trim(),
    pixTipo: form.elements.pixTipo.value,
    pixNome: form.elements.pixNome.value.trim(),
    pixBanco: form.elements.pixBanco.value.trim(),
    whatsapp: onlyDigits(form.elements.whatsapp.value),
    notificationEmail: form.elements.notificationEmail.value.trim(),
    valorTotal: lerValor(form.elements.valorTotal.value),
  };
  const minimo = JOGOS_POR_PARTICIPANTE * COTA.precoAposta;
  if (!payload.pixKey) return toast("Informe a chave PIX.", "error");
  if (payload.whatsapp && (payload.whatsapp.length < 10 || payload.whatsapp.length > 13)) return toast("WhatsApp inválido. Informe o número com DDD.", "error");
  if (!(payload.valorTotal >= minimo)) return toast(`O valor da cota deve ser de pelo menos ${formatBRL(minimo)}.`, "error");
  if (payload.notificationEmail && !form.elements.notificationEmail.checkValidity()) return toast("E-mail de notificação inválido.", "error");

  const cotaAntes = valores().total;
  if (payload.valorTotal !== cotaAntes && !(await confirmDialog(
    `Alterar a cota de ${formatBRL(cotaAntes)} para ${formatBRL(payload.valorTotal)}? Quem ainda não pagou passa a ver o novo valor; quem já está como "Pago" continua pago.`,
    { title: "Alterar valor da cota", okText: "Alterar cota" }))) return;

  const res = await withLoading(form.querySelector('[type="submit"]'), () => api("adminSavePixConfig", { token: sessao(), ...payload }));
  notify(res, "Configurações salvas!");
  if (!res.success) return;
  Object.assign(dados().config, payload, res.config ?? {});
  renderMetricas(); // o valor da cota muda arrecadado/fundo e o "falta" dos parciais
  renderTabela();
}

// ---------- Abas ----------

export function trocarAba(nome) {
  $$("[data-action='tab']").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === nome)));
  $$("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== nome; });
}
