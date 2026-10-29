/**
 * ============================================================================
 * CONTROLADOR ADMINISTRATIVO - BOLÃO MEGA DA VIRADA
 * ============================================================================
 */

const AdminApp = {
  adminPassword: null,
  data: null,
  activeTab: "participants",

  // Estado para cadastro de jogo oficial (6 a 9 dezenas)
  targetGameSize: 7, // padrão: super jogo de 7 dezenas
  adminSelectedBalls: [],

  init: function() {
    this.checkMockBanner();
    this.renderAdminLotteryGrid();
    this.checkSession();
  },

  checkMockBanner: function() {
    const banner = document.getElementById("mockBanner");
    if (banner && Api.isMock()) {
      banner.style.display = "flex";
    }
  },

  checkSession: function() {
    const savedPass = sessionStorage.getItem("megadavirada_admin_pass");
    if (savedPass) {
      this.adminPassword = savedPass;
      this.loadAdminData();
    } else {
      this.showView("login");
    }
  },

  logout: function() {
    sessionStorage.removeItem("megadavirada_admin_pass");
    this.adminPassword = null;
    this.data = null;
    this.showView("login");
    this.showToast("Sessão administrativa encerrada.", "info");
  },

  showView: function(view) {
    document.getElementById("viewAdminLogin").style.display = (view === "login") ? "block" : "none";
    document.getElementById("viewAdminDashboard").style.display = (view === "dashboard") ? "block" : "none";
  },

  // ==========================================================================
  // LOGIN ADMINISTRATIVO
  // ==========================================================================
  async handleLogin(event) {
    event.preventDefault();
    const passInput = document.getElementById("adminPassword");
    const pass = passInput.value.trim();
    const btn = document.getElementById("btnAdminLogin");

    if (!pass) {
      this.showToast("Informe a senha de administrador.", "error");
      return;
    }

    this.setButtonLoading(btn, true, "Verificando...");
    try {
      const res = await Api.adminLogin(pass);
      this.setButtonLoading(btn, false, "Entrar no Painel");

      if (res.success) {
        this.adminPassword = pass;
        sessionStorage.setItem("megadavirada_admin_pass", pass);
        this.showToast("Acesso administrativo confirmado!", "success");
        this.loadAdminData();
      } else {
        this.showToast(res.error || "Senha incorreta.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "Entrar no Painel");
      this.showToast("Erro ao tentar autenticar.", "error");
    }
  },

  // ==========================================================================
  // CARREGAMENTO E ATUALIZAÇÃO DE DADOS
  // ==========================================================================
  async loadAdminData() {
    if (!this.adminPassword) return;

    try {
      const res = await Api.adminGetData(this.adminPassword);
      if (res.success) {
        this.data = res;
        this.showView("dashboard");
        this.renderMetrics();
        this.renderParticipantsTable();
        this.renderBolaoGamesList();
        this.renderPixConfig();
        this.updateBolaoBanner(res.config);
      } else {
        this.showToast(res.error || "Falha ao carregar dados do painel.", "error");
        this.logout();
      }
    } catch (e) {
      this.showToast("Erro de comunicação com o servidor.", "error");
    }
  },

  refreshData: function() {
    this.loadAdminData();
    this.showToast("Dados atualizados!", "info");
  },

  // Atualiza o banner de status do bolão
  updateBolaoBanner: function(config) {
    if (!config) return;
    const statusBolao = config.StatusBolao || "Aberto";
    const regLoteria = config.RegistroLoteria === "true" || config.RegistroLoteria === true;
    const isFechado = statusBolao === "Fechado";

    const labelStatus = document.getElementById("adminStatusBolaoLabel");
    const labelLot = document.getElementById("adminRegistroLotLabel");
    const btnClose = document.getElementById("btnCloseBolao");
    const btnReopen = document.getElementById("btnReopenBolao");
    const btnLottery = document.getElementById("btnConfirmLottery");

    if (labelStatus) {
      if (isFechado) {
        labelStatus.className = "status-badge status-pendente";
        labelStatus.textContent = "🔒 Fechado";
      } else {
        labelStatus.className = "status-badge status-pago";
        labelStatus.textContent = "🟢 Aberto";
      }
    }

    if (labelLot) {
      labelLot.textContent = regLoteria ? "✅ Jogos registrados na loteria" : "⏳ Aguardando registro na loteria";
    }

    if (btnClose) btnClose.style.display = isFechado ? "none" : "inline-flex";
    if (btnReopen) btnReopen.style.display = isFechado ? "inline-flex" : "none";
    if (btnLottery) btnLottery.style.display = regLoteria ? "none" : "inline-flex";
  },

  // Fechar bolão
  async closeBolao() {
    if (!confirm("Fechar o bolão? Novos cadastros e confirmações de pagamento serão bloqueados. O status de registro na loteria NÃO será alterado.")) return;
    try {
      const res = await Api.adminCloseBolao(this.adminPassword);
      if (res.success) {
        this.showToast("Bolão fechado com sucesso!", "success");
        if (this.data && this.data.config) {
          this.data.config.StatusBolao = "Fechado";
          this.updateBolaoBanner(this.data.config);
        }
      } else {
        this.showToast(res.error || "Erro ao fechar bolão.", "error");
      }
    } catch (e) {
      this.showToast("Falha de comunicação.", "error");
    }
  },

  // Reabrir bolão
  async reopenBolao() {
    if (!confirm("Reabrir o bolão? Novos cadastros e confirmações de pagamento serão liberados novamente.")) return;
    try {
      const res = await Api.adminOpenBolao(this.adminPassword);
      if (res.success) {
        this.showToast("Bolão reaberto com sucesso!", "success");
        if (this.data && this.data.config) {
          this.data.config.StatusBolao = "Aberto";
          this.updateBolaoBanner(this.data.config);
        }
      } else {
        this.showToast(res.error || "Erro ao reabrir bolão.", "error");
      }
    } catch (e) {
      this.showToast("Falha de comunicação.", "error");
    }
  },

  // Confirmar registro na loteria
  async confirmLottery() {
    if (!confirm("Confirmar o registro dos jogos na Loteria Federal? Isso irá fechar o bolão automaticamente e notificar que os jogos foram registrados. Esta ação não pode ser desfeita facilmente.")) return;
    try {
      const res = await Api.adminConfirmLottery(this.adminPassword);
      if (res.success) {
        this.showToast("Registro na loteria confirmado! Participantes serão notificados.", "success");
        if (this.data && this.data.config) {
          this.data.config.StatusBolao = "Fechado";
          this.data.config.RegistroLoteria = "true";
          this.updateBolaoBanner(this.data.config);
        }
      } else {
        this.showToast(res.error || "Erro ao confirmar registro.", "error");
      }
    } catch (e) {
      this.showToast("Falha de comunicação.", "error");
    }
  },

  // ==========================================================================
  // MÉTRICAS GERAIS
  // ==========================================================================
  renderMetrics: function() {
    if (!this.data) return;

    const parts = this.data.participants || [];
    const total = parts.length;
    const paid = parts.filter(p => (p.paymentStatus || "").toLowerCase() === "pago").length;
    const pending = total - paid;
    // Cada cota paga tem R$ 15,00 para o fundo de super jogos
    const poolFundValue = paid * 15.00;

    document.getElementById("metricTotalParticipants").textContent = total;
    document.getElementById("metricPaidParticipants").textContent = paid;
    document.getElementById("metricPendingParticipants").textContent = pending;
    document.getElementById("metricPoolFund").textContent = `R$ ${poolFundValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    document.getElementById("participantsCountBadge").textContent = `${total} cadastrados`;
  },

  // ==========================================================================
  // ABA 1: TABELA DE PARTICIPANTES & BAIXAS
  // ==========================================================================
  renderParticipantsTable: function() {
    if (!this.data) return;

    const tbody = document.getElementById("adminParticipantsTableBody");
    tbody.innerHTML = "";

    const search = (document.getElementById("adminSearchInput")?.value || "").toLowerCase().trim();
    const statusFilter = document.getElementById("adminStatusFilter")?.value || "todos";

    let parts = [...(this.data.participants || [])];

    // Filtragem
    if (search) {
      parts = parts.filter(p => 
        (p.name || "").toLowerCase().includes(search) || 
        (p.phone || "").includes(search)
      );
    }

    if (statusFilter !== "todos") {
      parts = parts.filter(p => (p.paymentStatus || "").toLowerCase() === statusFilter.toLowerCase());
    }

    if (parts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Nenhum participante encontrado com os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    parts.forEach(p => {
      const isPaid = (p.paymentStatus || "").toLowerCase() === "pago";
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><strong>${this.escapeHtml(p.name)}</strong></td>
        <td>${this.formatPhone(p.phone)}</td>
        <td>${p.birthdate || "-"}</td>
        <td>
          <span style="font-weight: 700; color: ${p.gamesCount >= 5 ? 'var(--gold-primary)' : 'var(--text-muted)'};">
            ${p.gamesCount || 0} jogos
          </span>
        </td>
        <td>
          <span class="status-badge ${isPaid ? 'status-pago' : 'status-pendente'}">
            ${isPaid ? 'Pago' : 'Pendente'}
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn ${isPaid ? 'btn-secondary' : 'btn-success'}" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;" onclick="AdminApp.togglePaymentStatus('${p.id}', '${isPaid ? 'Pendente' : 'Pago'}')">
              ${isPaid ? '↩ Voltar Pendente' : '✓ Dar Baixa (Pago)'}
            </button>
            <button type="button" class="btn btn-outline-gold" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;" onclick="AdminApp.viewParticipantGames('${p.id}')">
              👁️ Jogos
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  },

  filterParticipants: function() {
    this.renderParticipantsTable();
  },

  async togglePaymentStatus(participantId, newStatus) {
    try {
      const res = await Api.adminUpdatePayment(this.adminPassword, participantId, newStatus);
      if (res.success) {
        this.showToast(`Status atualizado para ${newStatus}!`, "success");
        // Atualiza no cache local e re-renderiza
        const p = this.data.participants.find(item => item.id === participantId);
        if (p) p.paymentStatus = newStatus;
        this.renderMetrics();
        this.renderParticipantsTable();
      } else {
        this.showToast(res.error || "Erro ao atualizar status.", "error");
      }
    } catch (e) {
      this.showToast("Falha ao comunicar com o servidor.", "error");
    }
  },

  viewParticipantGames: function(participantId) {
    const p = this.data.participants.find(item => item.id === participantId);
    if (!p) return;

    document.getElementById("modalParticipantName").textContent = `Jogos de ${p.name}`;
    const modalContent = document.getElementById("modalGamesContent");
    modalContent.innerHTML = "";

    if (p.games && p.games.length > 0) {
      p.games.forEach((g, idx) => {
        const card = document.createElement("div");
        card.className = "game-card";
        card.innerHTML = `
          <div class="game-card-header"><strong>Jogo #${g.jogoNumero || idx + 1}</strong></div>
          <div class="selected-balls-row">
            ${g.dezenas.split(",").map(n => `<span class="ball-tag">${n.trim()}</span>`).join("")}
          </div>
        `;
        modalContent.appendChild(card);
      });
    } else {
      modalContent.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nenhum jogo registrado por este participante ainda.</p>`;
    }

    const modal = document.getElementById("modalParticipantGames");
    modal.style.display = "flex";
  },

  closeGamesModal: function() {
    document.getElementById("modalParticipantGames").style.display = "none";
  },

  // ==========================================================================
  // ABA 2: CADASTRO DE JOGO OFICIAL (6, 7, 8 OU 9 DEZENAS)
  // ==========================================================================
  renderAdminLotteryGrid: function() {
    const container = document.getElementById("adminLotteryGrid");
    if (!container) return;

    container.innerHTML = "";
    for (let i = 1; i <= 60; i++) {
      const ball = document.createElement("button");
      ball.type = "button";
      ball.className = "ball-btn";
      ball.id = `admin-ball-${i}`;
      ball.textContent = i < 10 ? `0${i}` : `${i}`;
      ball.onclick = () => this.toggleAdminBall(i);
      container.appendChild(ball);
    }
  },

  setGameSize: function(size) {
    this.targetGameSize = size;
    // Atualiza botões de seleção de tamanho
    document.querySelectorAll(".game-size-btn").forEach(btn => {
      const bSize = Number(btn.getAttribute("data-size"));
      btn.classList.toggle("active", bSize === size);
      btn.classList.toggle("btn-outline-gold", bSize === size);
      btn.classList.toggle("btn-secondary", bSize !== size);
    });

    document.getElementById("adminTargetCount").textContent = size;

    // Se a seleção atual ultrapassa o novo tamanho, corta
    if (this.adminSelectedBalls.length > size) {
      this.adminSelectedBalls = this.adminSelectedBalls.slice(0, size);
    }

    this.updateAdminSelectionUI();
  },

  toggleAdminBall: function(num) {
    const idx = this.adminSelectedBalls.indexOf(num);
    if (idx !== -1) {
      this.adminSelectedBalls.splice(idx, 1);
    } else {
      if (this.adminSelectedBalls.length >= this.targetGameSize) {
        this.showToast(`Limite de ${this.targetGameSize} dezenas atingido para este formato.`, "info");
        return;
      }
      this.adminSelectedBalls.push(num);
    }

    this.adminSelectedBalls.sort((a, b) => a - b);
    this.updateAdminSelectionUI();
  },

  updateAdminSelectionUI: function() {
    const count = this.adminSelectedBalls.length;
    document.getElementById("adminSelectedCount").textContent = count;
    document.getElementById("adminTargetCount").textContent = this.targetGameSize;

    // Atualiza barra de resumo
    const row = document.getElementById("adminSelectedBallsRow");
    row.innerHTML = "";

    for (let i = 0; i < this.targetGameSize; i++) {
      const tag = document.createElement("span");
      if (i < count) {
        const n = this.adminSelectedBalls[i];
        tag.className = "ball-tag" + (this.targetGameSize > 6 ? "" : " ball-admin");
        tag.textContent = n < 10 ? `0${n}` : `${n}`;
      } else {
        tag.className = "ball-tag empty";
        tag.textContent = "-";
      }
      row.appendChild(tag);
    }

    // Atualiza botões da grade
    const isFull = count >= this.targetGameSize;
    for (let i = 1; i <= 60; i++) {
      const ball = document.getElementById(`admin-ball-${i}`);
      if (ball) {
        const isSelected = this.adminSelectedBalls.includes(i);
        ball.classList.toggle("selected", isSelected);
        ball.disabled = isFull && !isSelected;
      }
    }

    const btnSave = document.getElementById("btnAdminSaveGame");
    btnSave.disabled = count !== this.targetGameSize;
  },

  pickRandomNumbers: function() {
    const target = this.targetGameSize;
    const current = [...(this.adminSelectedBalls || [])];
    const needed = target - current.length;

    if (needed <= 0) {
      this.showToast(`Já foram selecionadas todas as ${target} dezenas!`, "info");
      return;
    }

    const picked = [...current];
    while (picked.length < target) {
      const r = Math.floor(Math.random() * 60) + 1;
      if (!picked.includes(r)) picked.push(r);
    }
    picked.sort((a, b) => a - b);
    this.adminSelectedBalls = picked;
    this.updateAdminSelectionUI();
    if (current.length > 0) {
      this.showToast(`Jogo completado com mais ${needed} dezena(s) pela Surpresinha!`, "info");
    } else {
      this.showToast(`${target} dezenas geradas via Surpresinha!`, "info");
    }
  },

  clearSelection: function() {
    this.adminSelectedBalls = [];
    this.updateAdminSelectionUI();
  },

  async saveOfficialGame() {
    if (this.adminSelectedBalls.length !== this.targetGameSize) {
      this.showToast(`Selecione exatamente ${this.targetGameSize} dezenas.`, "error");
      return;
    }

    const btn = document.getElementById("btnAdminSaveGame");
    this.setButtonLoading(btn, true, "Salvando jogo oficial...");

    try {
      const res = await Api.adminAddGame(this.adminPassword, this.adminSelectedBalls);
      this.setButtonLoading(btn, false, "💾 Salvar Jogo Oficial do Bolão");

      if (res.success) {
        this.showToast(`Super jogo de ${this.targetGameSize} dezenas salvo com sucesso!`, "success");
        this.clearSelection();
        this.loadAdminData();
        this.switchTab("bolaoList");
      } else {
        this.showToast(res.error || "Erro ao salvar jogo do bolão.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "💾 Salvar Jogo Oficial do Bolão");
      this.showToast("Erro ao comunicar com o servidor.", "error");
    }
  },

  // ==========================================================================
  // ABA 3: LISTA DE JOGOS OFICIAIS DO BOLÃO
  // ==========================================================================
  renderBolaoGamesList: function() {
    const container = document.getElementById("adminBolaoListContainer");
    if (!container) return;

    container.innerHTML = "";
    const games = this.data.bolaoGames || [];

    if (games.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum jogo oficial cadastrado ainda. Use a aba "Cadastrar Jogo Oficial" para adicionar jogos de 6 a 9 dezenas!
        </div>
      `;
      return;
    }

    games.forEach((g, idx) => {
      const isSuper = Number(g.qtdDezenas) > 6;
      const card = document.createElement("div");
      card.className = isSuper ? "super-game-card" : "game-card";

      const header = document.createElement("div");
      header.className = "game-card-header";
      header.innerHTML = `
        <div>
          <strong>Jogo Oficial #${idx + 1} (${g.qtdDezenas} dezenas)</strong>
          <span class="badge ${isSuper ? 'badge-gold' : 'badge-green'}" style="margin-left: 0.5rem;">
            ${isSuper ? '★ SUPER APOSTA ★' : 'Aposta Oficial'}
          </span>
        </div>
        <button type="button" class="btn btn-danger" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="AdminApp.deleteOfficialGame('${g.id}')">
          🗑️ Excluir
        </button>
      `;

      const ballsRow = document.createElement("div");
      ballsRow.className = "selected-balls-row";
      const nums = (g.dezenas || "").split(",").map(s => s.trim());
      nums.forEach(n => {
        const ball = document.createElement("span");
        ball.className = "ball-tag" + (isSuper ? "" : " ball-admin");
        ball.textContent = n;
        ballsRow.appendChild(ball);
      });

      card.appendChild(header);
      card.appendChild(ballsRow);
      container.appendChild(card);
    });
  },

  async deleteOfficialGame(gameId) {
    if (!confirm("Tem certeza que deseja excluir este jogo oficial do bolão?")) {
      return;
    }

    try {
      const res = await Api.adminDeleteGame(this.adminPassword, gameId);
      if (res.success) {
        this.showToast("Jogo excluído com sucesso.", "info");
        this.loadAdminData();
      } else {
        this.showToast(res.error || "Erro ao excluir jogo.", "error");
      }
    } catch (e) {
      this.showToast("Falha de comunicação.", "error");
    }
  },

  // ==========================================================================
  // CONFIGURAÇÃO DO PIX
  // ==========================================================================
  renderPixConfig: function() {
    if (!this.data || !this.data.config) return;
    const cfg = this.data.config;
    const keyInput = document.getElementById("cfgPixKey");
    const typeSelect = document.getElementById("cfgPixType");
    const nameInput = document.getElementById("cfgPixName");
    const emailInput = document.getElementById("cfgNotificationEmail");

    if (keyInput) keyInput.value = cfg.pixKey || "";
    if (typeSelect) typeSelect.value = cfg.pixTipo || "E-mail";
    if (nameInput) nameInput.value = cfg.pixNome || "";
    if (emailInput) emailInput.value = cfg.notificationEmail || "";
  },

  async savePixConfig(event) {
    event.preventDefault();
    const keyInput = document.getElementById("cfgPixKey");
    const typeSelect = document.getElementById("cfgPixType");
    const nameInput = document.getElementById("cfgPixName");
    const emailInput = document.getElementById("cfgNotificationEmail");
    const btn = document.getElementById("btnSavePixConfig");

    const pixKey = (keyInput ? keyInput.value : "").trim();
    const pixTipo = typeSelect ? typeSelect.value : "E-mail";
    const pixNome = (nameInput ? nameInput.value : "").trim();
    const notificationEmail = (emailInput ? emailInput.value : "").trim();

    if (!pixKey) {
      this.showToast("Informe a chave PIX.", "error");
      return;
    }

    this.setButtonLoading(btn, true, "Salvando configurações...");

    try {
      const res = await Api.adminSavePixConfig(this.adminPassword, {
        pixKey,
        pixTipo,
        pixNome,
        notificationEmail
      });
      this.setButtonLoading(btn, false, "💾 Salvar Configurações (PIX & Notificações)");

      if (res.success) {
        this.showToast("Configurações atualizadas com sucesso!", "success");
        if (this.data && this.data.config) {
          this.data.config.pixKey = pixKey;
          this.data.config.pixTipo = pixTipo;
          this.data.config.pixNome = pixNome;
          this.data.config.notificationEmail = notificationEmail;
        }
      } else {
        this.showToast(res.error || "Erro ao salvar configurações.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "💾 Salvar Configurações (PIX & Notificações)");
      this.showToast("Erro ao conectar ao servidor.", "error");
    }
  },

  // ==========================================================================
  // NAVEGAÇÃO DE ABAS ADMIN
  // ==========================================================================
  switchTab: function(tab) {
    this.activeTab = tab;
    document.getElementById("tabAdminParticipants").classList.toggle("active", tab === "participants");
    document.getElementById("tabAdminNewGame").classList.toggle("active", tab === "newGame");
    document.getElementById("tabAdminBolaoList").classList.toggle("active", tab === "bolaoList");
    const tabConfig = document.getElementById("tabAdminConfig");
    if (tabConfig) tabConfig.classList.toggle("active", tab === "config");

    document.getElementById("secAdminParticipants").style.display = (tab === "participants") ? "block" : "none";
    document.getElementById("secAdminNewGame").style.display = (tab === "newGame") ? "block" : "none";
    document.getElementById("secAdminBolaoList").style.display = (tab === "bolaoList") ? "block" : "none";
    const secConfig = document.getElementById("secAdminConfig");
    if (secConfig) secConfig.style.display = (tab === "config") ? "block" : "none";

    if (tab === "newGame") {
      this.updateAdminSelectionUI();
    } else if (tab === "config") {
      this.renderPixConfig();
    }
  },

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================
  formatPhone: function(p) {
    if (!p) return "-";
    const clean = p.replace(/\D/g, "");
    if (clean.length === 11) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    }
    return p;
  },

  escapeHtml: function(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  setButtonLoading: function(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<span class="spinner"></span> <span>${text}</span>`;
    } else {
      btn.innerHTML = `<span>${text}</span>`;
    }
  },

  showToast: function(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.2rem;">${icon}</span>
        <span style="font-size: 0.9rem;">${message}</span>
      </div>
      <div>
      <button style="background: none; border: none; color: white; cursor: pointer; font-size: 1rem;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  // ============================================================================
  // DOWNLOAD DE JOGOS
  // ============================================================================

  /**
   * Coleta todos os jogos (bolão + participantes) e baixa como TXT.
   * Formato: 02,07,15,23,28,50 (uma linha por jogo)
   */
  async downloadAllGamesTxt() {
    this.showToast("Preparando arquivo TXT...", "info");
    try {
      const res = await Api.adminExportAllJSON(this.adminPassword);
      if (!res.success) {
        this.showToast(res.error || "Erro ao obter jogos.", "error");
        return;
      }
      if (typeof PdfGenerator === "undefined") {
        this.showToast("Módulo de geração não carregado. Recarregue a página.", "error");
        return;
      }
      const games = res.games || [];
      if (games.length === 0) {
        this.showToast("Nenhum jogo cadastrado para exportar.", "error");
        return;
      }
      PdfGenerator.downloadTxt(games);
      this.showToast(`${games.length} jogo(s) exportado(s) para TXT com sucesso!`, "success");
    } catch (e) {
      this.showToast("Falha ao gerar TXT: " + e.message, "error");
    }
  },

  /**
   * Coleta todos os jogos e baixa como PDF.
   */
  async downloadAllGamesPDF() {
    this.showToast("Gerando PDF com todos os jogos...", "info");
    try {
      const res = await Api.adminExportAllJSON(this.adminPassword);
      if (!res.success) {
        this.showToast(res.error || "Erro ao obter jogos.", "error");
        return;
      }
      if (typeof PdfGenerator === "undefined" || typeof window.jspdf === "undefined") {
        this.showToast("Módulo jsPDF não carregado. Recarregue a página.", "error");
        return;
      }
      const games = res.games || [];
      if (games.length === 0) {
        this.showToast("Nenhum jogo cadastrado para exportar.", "error");
        return;
      }
      setTimeout(() => {
        PdfGenerator.generateAllGamesPdf(games, "Todos os Jogos do Bolão - Mega da Virada");
        AdminApp.showToast(`PDF gerado com ${games.length} jogo(s)!`, "success");
      }, 200);
    } catch (e) {
      this.showToast("Falha ao gerar PDF: " + e.message, "error");
    }
  }
};

// Registra Service Worker se suportado
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

document.addEventListener("DOMContentLoaded", () => AdminApp.init());
