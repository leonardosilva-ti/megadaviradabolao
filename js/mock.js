/**
 * Simulador local do backend (Google Apps Script) para o modo demonstração.
 * Reproduz as mesmas ações e o mesmo formato de resposta do code.gs,
 * gravando tudo no localStorage do navegador.
 */
import { COTA, DEMO } from "./config.js";
import { local, onlyDigits, pad2 } from "./utils.js";

const KEYS = {
  participantes: "megadavirada_participantes",
  jogos: "megadavirada_jogos",
  bolao: "megadavirada_bolao",
  config: "megadavirada_config",
};

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const formatar = (nums) => [...nums].map(Number).sort((a, b) => a - b).map(pad2).join(", ");

function seed() {
  if (!local.get(KEYS.config)) {
    local.set(KEYS.config, {
      pixKey: DEMO.pix.chave, pixTipo: DEMO.pix.tipo, pixNome: DEMO.pix.titular,
      notificationEmail: "", valorTotal: COTA.total.toFixed(2), StatusBolao: "Aberto", RegistroLoteria: "false",
    });
  }
  if (!local.get(KEYS.participantes)) {
    local.set(KEYS.participantes, [
      { id: "p-demo-1", name: "Carlos Eduardo Silva", phone: "11987654321", birthdate: "15/05/1985", paymentStatus: "Pago", createdAt: now() },
      { id: "p-demo-2", name: "Mariana Souza", phone: "21998765432", birthdate: "20/11/1992", paymentStatus: "Pendente", createdAt: now() },
    ]);
  }
  if (!local.get(KEYS.jogos)) {
    const j = (participantId, gameNumber, dezenas) => ({ id: uid("j"), participantId, gameNumber, dezenas });
    local.set(KEYS.jogos, [
      j("p-demo-1", 1, "04, 12, 23, 35, 44, 58"), j("p-demo-1", 2, "07, 14, 28, 31, 49, 52"),
      j("p-demo-1", 3, "01, 19, 25, 38, 42, 60"), j("p-demo-1", 4, "09, 13, 27, 34, 46, 53"),
      j("p-demo-1", 5, "03, 11, 22, 39, 47, 57"),
      j("p-demo-2", 1, "02, 16, 24, 37, 45, 59"), j("p-demo-2", 2, "05, 10, 21, 33, 48, 56"),
      j("p-demo-2", 3, "06, 17, 26, 32, 41, 55"), j("p-demo-2", 4, "08, 15, 29, 36, 43, 54"),
      j("p-demo-2", 5, "10, 18, 20, 30, 40, 50"),
    ]);
  }
  if (!local.get(KEYS.bolao)) {
    local.set(KEYS.bolao, [
      { id: "b-demo-1", qtdDezenas: 8, dezenas: "05, 10, 18, 26, 33, 42, 51, 60", tipo: "Oficial do Bolão", data: now() },
      { id: "b-demo-2", qtdDezenas: 7, dezenas: "03, 14, 22, 38, 45, 50, 58", tipo: "Oficial do Bolão", data: now() },
    ]);
  }
}

const db = {
  get: (key) => { seed(); return local.get(KEYS[key]) ?? []; },
  set: (key, value) => local.set(KEYS[key], value),
};

const isPago = (p) => String(p?.paymentStatus ?? "").toLowerCase() === "pago";
const autorizado = (data) => String(data.password ?? "").trim() === DEMO.adminSenha;
const negado = { success: false, error: "Acesso não autorizado." };
const fechado = () => db.get("config").StatusBolao === "Fechado";

function jogosDe(participantId) {
  return db.get("jogos")
    .filter((j) => j.participantId === participantId)
    .sort((a, b) => a.gameNumber - b.gameNumber)
    .map(({ id, gameNumber, dezenas }) => ({ id, gameNumber, dezenas }));
}

const actions = {
  login({ phone, birthdate }) {
    phone = onlyDigits(phone);
    birthdate = String(birthdate ?? "").trim();
    if (!phone || !birthdate) return { success: false, error: "Telefone e data de nascimento são obrigatórios." };
    const p = db.get("participantes").find((x) => onlyDigits(x.phone) === phone);
    if (!p) return { success: false, notFound: true, message: "Participante não encontrado com esse número de telefone." };
    if (p.birthdate !== birthdate) {
      return { success: false, error: "Data de nascimento incorreta para o telefone informado. Verifique se digitou o dia, mês e ano corretamente." };
    }
    const games = jogosDe(p.id);
    return { success: true, user: { id: p.id, name: p.name, phone: p.phone, birthdate, paymentStatus: p.paymentStatus, hasGames: games.length >= 5, games } };
  },

  register({ name, phone, birthdate }) {
    name = String(name ?? "").trim();
    phone = onlyDigits(phone);
    birthdate = String(birthdate ?? "").trim();
    if (!name) return { success: false, error: "Nome é obrigatório." };
    if (!phone) return { success: false, error: "Telefone é obrigatório." };
    if (!birthdate) return { success: false, error: "Data de nascimento é obrigatória." };
    if (fechado()) return { success: false, error: "O bolão está fechado. Novos cadastros não são permitidos." };

    const lista = db.get("participantes");
    if (lista.some((p) => onlyDigits(p.phone) === phone)) {
      return { success: false, error: "Já existe um participante cadastrado com este telefone. Faça login." };
    }
    const user = { id: uid("p"), name, phone, birthdate, paymentStatus: "Pendente", createdAt: now() };
    db.set("participantes", [...lista, user]);
    return { success: true, user: { id: user.id, name, phone, birthdate, paymentStatus: "Pendente" } };
  },

  saveGames({ participantId, games }) {
    if (!participantId) return { success: false, error: "ID do participante não informado." };
    if (!Array.isArray(games) || games.length !== 5) return { success: false, error: "É necessário enviar exatamente 5 jogos." };
    for (const [i, g] of games.entries()) {
      const nums = (g ?? []).map(Number);
      if (nums.length !== 6) return { success: false, error: `O Jogo ${i + 1} deve conter exatamente 6 dezenas.` };
      if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 60)) return { success: false, error: `O Jogo ${i + 1} tem número inválido (1–60).` };
      if (new Set(nums).size !== 6) return { success: false, error: `O Jogo ${i + 1} contém números repetidos.` };
    }
    const formatados = games.map(formatar);
    for (let i = 0; i < formatados.length; i++) {
      const j = formatados.indexOf(formatados[i], i + 1);
      if (j !== -1) return { success: false, error: `O Jogo ${i + 1} e o Jogo ${j + 1} são idênticos.` };
    }
    const outros = db.get("jogos").filter((j) => j.participantId !== participantId);
    db.set("jogos", [...outros, ...formatados.map((dezenas, i) => ({ id: uid("j"), participantId, gameNumber: i + 1, dezenas }))]);
    return { success: true, message: "Seus 5 jogos foram salvos com sucesso!", games: formatados };
  },

  confirmPayment({ participantId }) {
    if (!participantId) return { success: false, error: "ID do participante não informado." };
    if (fechado()) {
      const p = db.get("participantes").find((x) => x.id === participantId);
      return isPago(p)
        ? { success: true, message: "Seu pagamento já está confirmado!" }
        : { success: false, error: "O bolão está fechado. Não é mais possível confirmar pagamentos." };
    }
    return { success: true, message: "Pagamento informado com sucesso. Aguardando conferência do organizador." };
  },

  getDashboardData({ participantId }) {
    const p = db.get("participantes").find((x) => x.id === participantId);
    if (!p) return { success: false, error: "Participante não encontrado." };
    const { notificationEmail, ...config } = db.get("config");
    return {
      success: true,
      user: { id: p.id, name: p.name, phone: p.phone, paymentStatus: p.paymentStatus || "Pendente" },
      myGames: jogosDe(p.id),
      otherGames: db.get("jogos").filter((j) => j.participantId !== p.id).map((j) => ({ dezenas: j.dezenas })),
      bolaoGames: db.get("bolao").map(({ id, qtdDezenas, dezenas, tipo }) => ({ id, qtdDezenas, dezenas, tipo })),
      config,
    };
  },

  adminLogin(data) {
    return autorizado(data) ? { success: true, message: "Acesso administrativo concedido." } : { success: false, error: "Senha de administrador incorreta." };
  },

  adminGetData(data) {
    if (!autorizado(data)) return negado;
    const jogos = db.get("jogos");
    const participants = db.get("participantes").map((p) => {
      const games = jogos.filter((j) => j.participantId === p.id).map((j) => ({ jogoNumero: j.gameNumber, dezenas: j.dezenas }));
      return { ...p, gamesCount: games.length, games };
    });
    return { success: true, participants, bolaoGames: db.get("bolao"), config: db.get("config") };
  },

  adminUpdatePayment(data) {
    if (!autorizado(data)) return negado;
    if (!["Pago", "Pendente"].includes(data.status)) return { success: false, error: "Status inválido. Use 'Pago' ou 'Pendente'." };
    const lista = db.get("participantes");
    const p = lista.find((x) => x.id === data.participantId);
    if (!p) return { success: false, error: "Participante não encontrado." };
    p.paymentStatus = data.status;
    db.set("participantes", lista);
    return { success: true, message: `Status do participante alterado para '${data.status}'.` };
  },

  adminDeleteParticipant(data) {
    if (!autorizado(data)) return negado;
    const lista = db.get("participantes");
    const p = lista.find((x) => x.id === data.participantId);
    if (!p) return { success: false, error: "Participante não encontrado." };
    const jogos = db.get("jogos");
    const resto = jogos.filter((j) => j.participantId !== p.id);
    const removidos = jogos.length - resto.length;
    db.set("participantes", lista.filter((x) => x.id !== p.id));
    db.set("jogos", resto);
    return { success: true, message: `Participante ${p.name} excluído${removidos ? ` (com ${removidos} jogo(s)).` : "."}` };
  },

  adminAddGame(data) {
    if (!autorizado(data)) return negado;
    const nums = (data.dezenas ?? []).map(Number);
    if (nums.length < 6 || nums.length > 9) return { success: false, error: `O jogo deve ter entre 6 e 9 dezenas (recebido: ${nums.length}).` };
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 60)) return { success: false, error: "Dezena inválida (deve ser entre 1 e 60)." };
    if (new Set(nums).size !== nums.length) return { success: false, error: "Dezena repetida." };
    const game = { id: uid("b"), qtdDezenas: nums.length, dezenas: formatar(nums), tipo: "Oficial do Bolão", data: now() };
    db.set("bolao", [...db.get("bolao"), game]);
    return { success: true, message: `Jogo de ${nums.length} dezenas cadastrado com sucesso!`, game };
  },

  adminDeleteGame(data) {
    if (!autorizado(data)) return negado;
    const lista = db.get("bolao");
    const resto = lista.filter((g) => g.id !== data.gameId);
    if (resto.length === lista.length) return { success: false, error: "Jogo não encontrado." };
    db.set("bolao", resto);
    return { success: true, message: "Jogo excluído com sucesso." };
  },

  adminSavePixConfig(data) {
    if (!autorizado(data)) return negado;
    const pixKey = String(data.pixKey ?? "").trim();
    if (!pixKey) return { success: false, error: "A chave PIX não pode ficar vazia." };
    const cfg = db.get("config");
    Object.assign(cfg, {
      pixKey,
      pixTipo: String(data.pixTipo ?? "").trim() || cfg.pixTipo,
      pixNome: String(data.pixNome ?? "").trim() || cfg.pixNome,
      notificationEmail: String(data.notificationEmail ?? "").trim(),
    });
    db.set("config", cfg);
    return { success: true, message: "Configurações (PIX e notificações) salvas com sucesso!", config: cfg };
  },

  adminCloseBolao(data) { return setStatus(data, { StatusBolao: "Fechado" }, "Bolão fechado com sucesso. Novos cadastros e confirmações de pagamento estão bloqueados."); },
  adminOpenBolao(data) { return setStatus(data, { StatusBolao: "Aberto" }, "Bolão reaberto! Cadastros e confirmações de pagamento liberados."); },
  adminConfirmLottery(data) { return setStatus(data, { StatusBolao: "Fechado", RegistroLoteria: "true" }, "Registro na loteria confirmado! Bolão fechado. Todos verão a notificação."); },

  adminExportAllJSON(data) {
    if (!autorizado(data)) return negado;
    const parts = new Map(db.get("participantes").map((p) => [p.id, p]));
    const games = db.get("jogos").map((j) => {
      const p = parts.get(j.participantId);
      return { participantName: p?.name ?? "Desconhecido", paymentStatus: p?.paymentStatus ?? "Pendente", gameNumber: j.gameNumber, dezenas: j.dezenas };
    });
    return { success: true, games, total: games.length };
  },
};

function setStatus(data, patch, message) {
  if (!autorizado(data)) return negado;
  db.set("config", { ...db.get("config"), ...patch });
  return { success: true, message, ...patch };
}

export async function mockRequest(action, payload) {
  await new Promise((r) => setTimeout(r, 250)); // simula a latência da rede
  const handler = actions[action];
  return handler ? handler(payload) : { success: false, error: `Ação não reconhecida: ${action}` };
}
