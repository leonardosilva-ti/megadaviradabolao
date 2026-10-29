/**
 * ============================================================================
 * CONTROLADOR PRINCIPAL DO PARTICIPANTE - BOLÃO MEGA DA VIRADA
 * ============================================================================
 */

const App = {
  // Estado da aplicação
  currentUser: null,
  currentStep: 1, // 1 a 5 (jogos)
  selectedGames: [[], [], [], [], []], // 5 arrays com as dezenas de cada jogo
  dashboardData: null,

  // Inicialização
  init: function() {
    this.setupMasks();
    this.renderLotteryGrid();
    this.checkMockBanner();
    this.checkIosPwa();
    this.checkSession();
  },

  checkMockBanner: function() {
    const banner = document.getElementById("mockBanner");
    if (banner && Api.isMock()) {
      banner.style.display = "flex";
    }
  },

  // ==========================================================================
  // SESSÃO E NAVEGAÇÃO
  // ==========================================================================
  checkSession: function() {
    const saved = localStorage.getItem("megadavirada_session_user");
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser && this.currentUser.id) {
          this.loadUserDashboard();
          return;
        }
      } catch (e) {
        localStorage.removeItem("megadavirada_session_user");
      }
    }
    this.showView("viewAuth");
  },

  saveSession: function(user) {
    this.currentUser = user;
    localStorage.setItem("megadavirada_session_user", JSON.stringify(user));
  },

  logout: function() {
    this.currentUser = null;
    this.selectedGames = [[], [], [], [], []];
    this.currentStep = 1;
    localStorage.removeItem("megadavirada_session_user");
    this.showToast("Você saiu da sua conta.", "info");
    this.showView("viewAuth");
  },

  showView: function(viewId) {
    const views = ["viewAuth", "viewGamesWizard", "viewGamesReview", "viewPayment", "viewDashboard"];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === viewId) ? "block" : "none";
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  // Alternador da tela de login / cadastro
  switchAuthTab: function(tab) {
    const isLogin = tab === "login";
    document.getElementById("tabBtnLogin").classList.toggle("active", isLogin);
    document.getElementById("tabBtnRegister").classList.toggle("active", !isLogin);
    document.getElementById("formLogin").style.display = isLogin ? "block" : "none";
    document.getElementById("formRegister").style.display = isLogin ? "none" : "block";
  },

  // Máscaras de telefone e data
  setupMasks: function() {
    const applyPhoneMask = (input) => {
      input.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 10) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        } else if (v.length > 6) {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
        } else if (v.length > 0) {
          v = v.replace(/^(\d*)$/, "($1");
        }
        e.target.value = v;
      });
    };

    const applyDateMask = (input) => {
      input.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 8) v = v.substring(0, 8);
        if (v.length > 4) {
          v = v.replace(/^(\d{2})(\d{2})(\d{0,4})$/, "$1/$2/$3");
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,2})$/, "$1/$2");
        }
        e.target.value = v;
      });
    };

    const loginPhone = document.getElementById("loginPhone");
    const regPhone = document.getElementById("regPhone");
    const loginBirth = document.getElementById("loginBirthdate");
    const regBirth = document.getElementById("regBirthdate");

    if (loginPhone) applyPhoneMask(loginPhone);
    if (regPhone) applyPhoneMask(regPhone);
    if (loginBirth) applyDateMask(loginBirth);
    if (regBirth) applyDateMask(regBirth);
  },

  // ==========================================================================
  // AUTENTICAÇÃO (LOGIN & CADASTRO)
  // ==========================================================================
  async handleLoginSubmit(event) {
    event.preventDefault();
    const phoneInput = document.getElementById("loginPhone");
    const birthInput = document.getElementById("loginBirthdate");
    const submitBtn = document.getElementById("btnLoginSubmit");

    const phone = phoneInput.value.replace(/\D/g, "");
    const birthdate = birthInput.value.trim();

    if (phone.length < 10) {
      this.showToast("Informe um número de telefone com DDD válido.", "error");
      return;
    }
    if (birthdate.length !== 10) {
      this.showToast("Informe a data de nascimento no formato DD/MM/AAAA.", "error");
      return;
    }

    this.setButtonLoading(submitBtn, true, "Entrando...");
    try {
      const res = await Api.login(phone, birthdate);
      this.setButtonLoading(submitBtn, false, "Acessar Meu Bolão");

      if (res.success && res.user) {
        this.saveSession(res.user);
        this.showToast(`Bem-vindo(a) de volta, ${res.user.name}!`, "success");

        if (!res.user.hasGames) {
          this.startGamesWizard();
        } else {
          this.loadUserDashboard();
        }
      } else if (res.notFound) {
        this.showToast("Você ainda não possui cadastro. Conheça as regras do bolão e cadastre-se abaixo!", "info");
        this.switchAuthTab("register");
        document.getElementById("regPhone").value = phoneInput.value;
        document.getElementById("regBirthdate").value = birthInput.value;
      } else {
        this.showToast(res.error || "Erro ao realizar login.", "error");
      }
    } catch (e) {
      this.setButtonLoading(submitBtn, false, "Acessar Meu Bolão");
      this.showToast("Erro inesperado ao conectar.", "error");
    }
  },

  async handleRegisterSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("regName");
    const phoneInput = document.getElementById("regPhone");
    const birthInput = document.getElementById("regBirthdate");
    const submitBtn = document.getElementById("btnRegisterSubmit");

    const name = nameInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, "");
    const birthdate = birthInput.value.trim();

    if (name.length < 3) {
      this.showToast("Por favor, informe seu nome completo.", "error");
      return;
    }
    if (phone.length < 10) {
      this.showToast("Informe um telefone com DDD válido.", "error");
      return;
    }
    if (birthdate.length !== 10) {
      this.showToast("Informe a data de nascimento no formato DD/MM/AAAA.", "error");
      return;
    }

    const termsAccepted = document.getElementById("regTermsAccepted");
    if (termsAccepted && !termsAccepted.checked) {
      this.showToast("Você precisa ler e aceitar os termos do bolão para continuar.", "error");
      return;
    }

    this.setButtonLoading(submitBtn, true, "Cadastrando...");
    try {
      const res = await Api.register(name, phone, birthdate);
      this.setButtonLoading(submitBtn, false, "Cadastrar e Escolher Meus Jogos");

      if (res.success && res.user) {
        this.saveSession(res.user);
        this.showToast(`Cadastro realizado com sucesso, ${res.user.name}!`, "success");
        this.startGamesWizard();
      } else {
        this.showToast(res.error || "Erro ao realizar cadastro.", "error");
      }
    } catch (e) {
      this.setButtonLoading(submitBtn, false, "Cadastrar e Escolher Meus Jogos");
      this.showToast("Erro inesperado ao conectar.", "error");
    }
  },

  // ==========================================================================
  // WIZARD DE 5 JOGOS (60 BOLINHAS)
  // ==========================================================================
  startGamesWizard: function() {
    this.currentStep = 1;
    this.selectedGames = [[], [], [], [], []];

    const greeting = document.getElementById("wizardGreeting");
    if (greeting && this.currentUser) {
      greeting.textContent = `Olá, ${this.currentUser.name.split(" ")[0]}! Cadastre seus 5 palpites para a Mega da Virada.`;
    }

    this.showView("viewGamesWizard");
    this.updateWizardStepUI();
  },

  renderLotteryGrid: function() {
    const container = document.getElementById("lotteryGrid60");
    if (!container) return;

    container.innerHTML = "";
    for (let i = 1; i <= 60; i++) {
      const ball = document.createElement("button");
      ball.type = "button";
      ball.className = "ball-btn";
      ball.id = `ball-${i}`;
      ball.textContent = i < 10 ? `0${i}` : `${i}`;
      ball.onclick = () => this.toggleNumber(i);
      container.appendChild(ball);
    }
  },

  toggleNumber: function(num) {
    const gameIdx = this.currentStep - 1;
    let currentSelection = this.selectedGames[gameIdx];

    const index = currentSelection.indexOf(num);
    if (index !== -1) {
      // Já está selecionado: remove
      currentSelection.splice(index, 1);
    } else {
      // Não está selecionado: verifica se já atingiu o limite de 6
      if (currentSelection.length >= 6) {
        this.showToast("Você já selecionou 6 dezenas para este jogo. Desmarque uma antes de escolher outra.", "info");
        return;
      }
      currentSelection.push(num);
    }

    // Ordena dezenas
    currentSelection.sort((a, b) => a - b);
    this.updateWizardStepUI();
  },

  updateWizardStepUI: function() {
    const gameIdx = this.currentStep - 1;
    const currentSelection = this.selectedGames[gameIdx];

    // Atualiza stepper indicadores
    for (let i = 1; i <= 5; i++) {
      const ind = document.getElementById(`stepInd${i}`);
      if (ind) {
        ind.classList.remove("active", "completed");
        if (i === this.currentStep) {
          ind.classList.add("active");
        } else if (this.selectedGames[i - 1].length === 6) {
          ind.classList.add("completed");
        }
      }
    }

    // Atualiza contadores
    const countEl = document.getElementById("countSelectedBalls");
    if (countEl) countEl.textContent = currentSelection.length;

    const stepCounterText = document.getElementById("stepCounterText");
    if (stepCounterText) {
      stepCounterText.innerHTML = `Jogo <strong>${this.currentStep} de 5</strong>: <span id="countSelectedBalls">${currentSelection.length}</span> de <strong>6</strong> números marcados`;
    }

    // Atualiza bolinhas marcadas na barra de resumo do topo
    const summaryRow = document.getElementById("currentSelectedBallsRow");
    if (summaryRow) {
      summaryRow.innerHTML = "";
      for (let i = 0; i < 6; i++) {
        const ballTag = document.createElement("div");
        if (i < currentSelection.length) {
          const n = currentSelection[i];
          ballTag.className = "ball-tag";
          ballTag.textContent = n < 10 ? `0${n}` : `${n}`;
        } else {
          ballTag.className = "ball-tag empty";
          ballTag.textContent = "-";
        }
        summaryRow.appendChild(ballTag);
      }
    }

    // Atualiza botões da grade de 60
    const isFull = currentSelection.length >= 6;
    for (let i = 1; i <= 60; i++) {
      const ball = document.getElementById(`ball-${i}`);
      if (ball) {
        const isSelected = currentSelection.includes(i);
        ball.classList.toggle("selected", isSelected);
        ball.disabled = isFull && !isSelected;
      }
    }

    // Botões Anterior / Próximo
    const btnPrev = document.getElementById("btnPrevStep");
    const btnNext = document.getElementById("btnNextStep");

    if (btnPrev) {
      btnPrev.style.display = this.currentStep > 1 ? "inline-flex" : "none";
    }

    if (btnNext) {
      if (this.currentStep === 5) {
        btnNext.innerHTML = "<span>Revisar meus 5 Jogos →</span>";
        btnNext.className = "btn btn-success";
      } else {
        btnNext.innerHTML = `<span>Salvar e ir para o Jogo ${this.currentStep + 1} →</span>`;
        btnNext.className = "btn btn-primary";
      }
      btnNext.disabled = currentSelection.length !== 6;
    }
  },

  pickRandomNumbers: function() {
    const gameIdx = this.currentStep - 1;
    const current = [...(this.selectedGames[gameIdx] || [])];
    const needed = 6 - current.length;

    if (needed <= 0) {
      this.showToast("Este jogo já possui 6 dezenas selecionadas!", "info");
      return;
    }

    const picked = [...current];
    while (picked.length < 6) {
      const r = Math.floor(Math.random() * 60) + 1;
      if (!picked.includes(r)) picked.push(r);
    }
    picked.sort((a, b) => a - b);
    this.selectedGames[gameIdx] = picked;
    this.updateWizardStepUI();
    if (current.length > 0) {
      this.showToast(`Jogo completado com mais ${needed} dezena(s) pela Surpresinha!`, "info");
    } else {
      this.showToast("6 dezenas geradas via Surpresinha!", "info");
    }
  },

  clearCurrentGame: function() {
    const gameIdx = this.currentStep - 1;
    this.selectedGames[gameIdx] = [];
    this.updateWizardStepUI();
  },

  goToStep: function(step) {
    if (step < 1 || step > 5) return;
    this.currentStep = step;
    this.updateWizardStepUI();
  },

  prevStep: function() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateWizardStepUI();
    }
  },

  nextStep: function() {
    const gameIdx = this.currentStep - 1;
    const current = this.selectedGames[gameIdx];

    if (current.length !== 6) {
      this.showToast("Selecione exatamente 6 dezenas antes de continuar.", "error");
      return;
    }

    // Validação de Duplicidade: Verificar se o jogo atual é idêntico a algum outro já selecionado
    const currentStr = current.join(",");
    for (let i = 0; i < 5; i++) {
      if (i !== gameIdx && this.selectedGames[i].length === 6) {
        if (this.selectedGames[i].join(",") === currentStr) {
          this.showToast(`Atenção: Este jogo é idêntico ao Jogo ${i + 1}! Escolha uma combinação diferente.`, "error");
          return;
        }
      }
    }

    if (this.currentStep < 5) {
      this.currentStep++;
      this.updateWizardStepUI();
    } else {
      // Chegou ao final dos 5 jogos: abre tela de revisão
      this.showGamesReview();
    }
  },

  // ==========================================================================
  // REVISÃO E ENVIO DOS 5 JOGOS
  // ==========================================================================
  showGamesReview: function() {
    const container = document.getElementById("reviewGamesList");
    if (!container) return;

    container.innerHTML = "";
    this.selectedGames.forEach((game, idx) => {
      const card = document.createElement("div");
      card.className = "game-card";

      const header = document.createElement("div");
      header.className = "game-card-header";
      header.innerHTML = `<strong>Jogo ${idx + 1}</strong> <button type="button" class="btn btn-outline-gold" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="App.goToStepAndEdit(${idx + 1})">✏️ Alterar</button>`;

      const ballsRow = document.createElement("div");
      ballsRow.className = "selected-balls-row";
      game.forEach(n => {
        const ball = document.createElement("span");
        ball.className = "ball-tag";
        ball.textContent = n < 10 ? `0${n}` : `${n}`;
        ballsRow.appendChild(ball);
      });

      card.appendChild(header);
      card.appendChild(ballsRow);
      container.appendChild(card);
    });

    this.showView("viewGamesReview");
  },

  goToStepAndEdit: function(step) {
    this.goToStep(step);
    this.showView("viewGamesWizard");
  },

  backToWizard: function() {
    this.showView("viewGamesWizard");
  },

  async submitAllGames() {
    // Validação final de integridade
    for (let i = 0; i < 5; i++) {
      if (!this.selectedGames[i] || this.selectedGames[i].length !== 6) {
        this.showToast(`O Jogo ${i + 1} está incompleto. Selecione 6 dezenas.`, "error");
        this.goToStep(i + 1);
        this.showView("viewGamesWizard");
        return;
      }
    }

    // Validação de duplicidade entre todos os 5
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        if (this.selectedGames[i].join(",") === this.selectedGames[j].join(",")) {
          this.showToast(`O Jogo ${i + 1} e o Jogo ${j + 1} são idênticos! Por favor, diferencie os palpites.`, "error");
          return;
        }
      }
    }

    const btn = document.getElementById("btnConfirmAllGames");
    this.setButtonLoading(btn, true, "Salvando seus 5 jogos...");

    try {
      const res = await Api.saveGames(this.currentUser.id, this.selectedGames);
      this.setButtonLoading(btn, false, "✅ Confirmar e Ir para Pagamento");

      if (res.success) {
        this.currentUser.hasGames = true;
        this.saveSession(this.currentUser);
        this.showToast("Seus 5 jogos foram cadastrados com sucesso!", "success");
        this.openPaymentScreen();
      } else {
        this.showToast(res.error || "Erro ao salvar jogos.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "✅ Confirmar e Ir para Pagamento");
      this.showToast("Erro inesperado ao conectar.", "error");
    }
  },

  // ==========================================================================
  // TELA DE PAGAMENTO PIX
  // ==========================================================================
  getActivePixConfig: function() {
    const cfg = (this.dashboardData && this.dashboardData.config) ? this.dashboardData.config : {};
    return {
      chave: cfg.pixKey || CONFIG.PIX.chave,
      tipoChave: cfg.pixTipo || cfg.tipoChave || CONFIG.PIX.tipoChave,
      titular: cfg.pixNome || cfg.titular || CONFIG.PIX.titular
    };
  },

  openPaymentScreen: function() {
    const pix = this.getActivePixConfig();
    const pixVal = document.getElementById("pixKeyValue");
    const pixRec = document.getElementById("pixReceiverLabel");
    const pixType = document.getElementById("pixKeyTypeLabel");

    if (pixVal) pixVal.textContent = pix.chave;
    if (pixRec) pixRec.textContent = `Titular: ${pix.titular}`;
    if (pixType) pixType.textContent = `Chave PIX (${pix.tipoChave}):`;

    this.showView("viewPayment");
  },

  copyPixKey: function() {
    const pix = this.getActivePixConfig();
    const key = pix.chave;
    navigator.clipboard.writeText(key).then(() => {
      this.showToast("Chave PIX copiada para a área de transferência!", "success");
    }).catch(() => {
      this.showToast("Não foi possível copiar automaticamente. Selecione e copie manualmente.", "info");
    });
  },

  async confirmPayment() {
    const btn = document.getElementById("btnConfirmPayment");
    this.setButtonLoading(btn, true, "Registrando confirmação...");

    try {
      const res = await Api.confirmPayment(this.currentUser.id);
      this.setButtonLoading(btn, false, "💳 Confirmar Pagamento Realizado");

      if (res.success) {
        this.showToast("Pagamento informado! O organizador irá conferir e atualizar seu status.", "success");
        this.loadUserDashboard();
      } else {
        this.showToast(res.error || "Erro ao confirmar pagamento.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "💳 Confirmar Pagamento Realizado");
      this.showToast("Erro de comunicação.", "error");
    }
  },

  async confirmPaymentFromDashboard() {
    const btn = document.getElementById("btnDashConfirmPayment");
    this.setButtonLoading(btn, true, "Avisando organizador...");

    try {
      const res = await Api.confirmPayment(this.currentUser.id);
      this.setButtonLoading(btn, false, "✓ Já paguei via Pix");

      if (res.success) {
        this.showToast("Pagamento informado com sucesso! O organizador irá conferir.", "success");
        const alertMsg = document.getElementById("dashPaymentAlertMsg");
        if (alertMsg) {
          alertMsg.innerHTML = "⏳ <strong>Pagamento informado!</strong> Aguardando o organizador conferir e dar baixa.";
        }
        if (btn) {
          btn.style.display = "none";
        }
      } else {
        this.showToast(res.error || "Erro ao confirmar pagamento.", "error");
      }
    } catch (e) {
      this.setButtonLoading(btn, false, "✓ Já paguei via Pix");
      this.showToast("Erro de comunicação.", "error");
    }
  },

  // ==========================================================================
  // DASHBOARD DO PARTICIPANTE
  // ==========================================================================
  openDashboard: function() {
    this.loadUserDashboard();
  },

  async loadUserDashboard() {
    if (!this.currentUser) return;

    this.showView("viewDashboard");
    document.getElementById("dashUserName").textContent = this.currentUser.name;
    document.getElementById("dashUserPhone").textContent = this.formatPhone(this.currentUser.phone);

    try {
      const res = await Api.getDashboardData(this.currentUser.id);
      if (res.success) {
        this.dashboardData = res;
        this.renderDashboard();
      } else {
        this.showToast(res.error || "Não foi possível carregar dados atualizados.", "error");
      }
    } catch (e) {
      this.showToast("Erro ao carregar dados do painel.", "error");
    }
  },

  refreshDashboard: function() {
    this.loadUserDashboard();
    this.showToast("Dados atualizados!", "info");
  },

  renderDashboard: function() {
    if (!this.dashboardData) return;

    const user = this.dashboardData.user || this.currentUser;
    const isPaid = (user.paymentStatus || "").toLowerCase() === "pago";
    const config = this.dashboardData.config || {};
    const statusBolao = config.StatusBolao || "Aberto";
    const registroLoteria = config.RegistroLoteria === "true" || config.RegistroLoteria === true;
    const bolaoFechado = statusBolao === "Fechado";

    // Atualiza badge de status de pagamento
    const badge = document.getElementById("dashPaymentBadge");
    const alertBox = document.getElementById("dashPaymentAlert");

    if (badge) {
      if (isPaid) {
        badge.className = "status-badge status-pago";
        badge.innerHTML = "✅ Pagamento Confirmado";
      } else {
        badge.className = "status-badge status-pendente";
        badge.innerHTML = "⏳ Pagamento Pendente";
      }
    }

    if (alertBox) {
      if (!isPaid && bolaoFechado) {
        // Bolão fechado e não pagou: mostra aviso de não participação
        alertBox.style.display = "flex";
        const alertMsg = document.getElementById("dashPaymentAlertMsg");
        if (alertMsg) {
          alertMsg.innerHTML = "⛔ <strong>Você não está participando</strong> por não ter pago sua cota antes do fechamento do bolão.";
        }
        const btnPay = document.getElementById("btnDashConfirmPayment");
        if (btnPay) btnPay.style.display = "none";
      } else if (!isPaid) {
        alertBox.style.display = "flex";
        const btnPay = document.getElementById("btnDashConfirmPayment");
        if (btnPay) btnPay.style.display = "inline-flex";
      } else {
        alertBox.style.display = "none";
      }
    }

    // Banner de status do registro na loteria (acima dos jogos)
    const noticeEl = document.getElementById("lotteryNotice");
    // Mostrar/ocultar botão de download do comprovante
    const downloadBar = document.getElementById("dashDownloadBar");
    const hasMyGames = this.dashboardData.myGames && this.dashboardData.myGames.length > 0;
    if (downloadBar) downloadBar.style.display = hasMyGames ? "block" : "none";
    if (noticeEl) {
      if (registroLoteria) {
        noticeEl.innerHTML = `
          <div style="background: linear-gradient(135deg, #065f46, #047857); border: 1px solid #10b981; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">✅</span>
            <div>
              <strong style="color: #a7f3d0; font-size: 1rem;">Jogos Registrados na Loteria Federal!</strong>
              <p style="color: #d1fae5; margin: 0.25rem 0 0; font-size: 0.85rem;">Os jogos do bolão foram registrados oficialmente. Boa sorte a todos!</p>
            </div>
          </div>`;
        noticeEl.style.display = "block";
      } else if (bolaoFechado) {
        noticeEl.innerHTML = `
          <div style="background: rgba(217,119,6,0.15); border: 1px solid #d97706; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">⏳</span>
            <div>
              <strong style="color: #fcd34d; font-size: 1rem;">Aguardando Registro na Loteria</strong>
              <p style="color: #fde68a; margin: 0.25rem 0 0; font-size: 0.85rem;">Devido às instabilidades que ocorrem nos dias 30 e 31 de dezembro no sistema das loterias, os jogos serão cadastrados no dia <strong>29/12</strong>. O bolão está fechado para novos participantes.</p>
            </div>
          </div>`;
        noticeEl.style.display = "block";
      } else {
        noticeEl.style.display = "none";
      }
    }

    // Renderiza Meus 5 Jogos
    const myGamesContainer = document.getElementById("dashMyGamesList");
    if (myGamesContainer) {
      myGamesContainer.innerHTML = "";
      if (this.dashboardData.myGames && this.dashboardData.myGames.length > 0) {
        this.dashboardData.myGames.forEach(g => {
          myGamesContainer.appendChild(this.createGameCardEl(`Jogo ${g.gameNumber}`, g.dezenas));
        });
      } else {
        myGamesContainer.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            <p>Você ainda não cadastrou seus palpites.</p>
            <button type="button" class="btn btn-primary" style="margin-top: 1rem;" onclick="App.startGamesWizard()">Cadastrar 5 Jogos Agora</button>
          </div>
        `;
      }
    }

    // Renderiza Super Jogos do Bolão da Administração (Destaque para >6 dezenas!)
    const bolaoContainer = document.getElementById("dashBolaoGamesList");
    if (bolaoContainer) {
      bolaoContainer.innerHTML = "";
      const bGames = this.dashboardData.bolaoGames || [];
      if (bGames.length > 0) {
        bGames.forEach((bg, idx) => {
          const isSuper = Number(bg.qtdDezenas) > 6;
          const card = document.createElement("div");
          card.className = isSuper ? "super-game-card" : "game-card";

          const header = document.createElement("div");
          header.className = "game-card-header";
          header.innerHTML = `
            <strong>Jogo Oficial #${idx + 1} (${bg.qtdDezenas} dezenas)</strong>
            <span class="badge ${isSuper ? 'badge-gold' : 'badge-green'}">${isSuper ? '★ SUPER APOSTA ★' : 'Aposta Oficial'}</span>
          `;

          const ballsRow = document.createElement("div");
          ballsRow.className = "selected-balls-row";
          const nums = (bg.dezenas || "").split(",").map(s => s.trim());
          nums.forEach(n => {
            const ball = document.createElement("span");
            ball.className = "ball-tag" + (isSuper ? "" : " ball-admin");
            ball.textContent = n;
            ballsRow.appendChild(ball);
          });

          card.appendChild(header);
          card.appendChild(ballsRow);
          bolaoContainer.appendChild(card);
        });
      } else {
        bolaoContainer.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            Nenhum jogo especial registrado ainda pela administração. Assim que as cotas forem confirmadas, o organizador registrará os jogos oficiais aqui!
          </div>
        `;
      }
    }

    // Renderiza Jogos dos Outros Participantes (Anônimo - Somente as dezenas)
    const othersContainer = document.getElementById("dashOtherGamesList");
    if (othersContainer) {
      othersContainer.innerHTML = "";
      const oGames = this.dashboardData.otherGames || [];
      if (oGames.length > 0) {
        oGames.forEach((og, idx) => {
          const card = document.createElement("div");
          card.className = "game-card";

          const header = document.createElement("div");
          header.className = "game-card-header";
          header.innerHTML = `
            <span>Jogo registrado da comunidade #${idx + 1}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Aposta de 6 números</span>
          `;

          const ballsRow = document.createElement("div");
          ballsRow.className = "selected-balls-row";
          const nums = (og.dezenas || "").split(",").map(s => s.trim());
          nums.forEach(n => {
            const ball = document.createElement("span");
            ball.className = "ball-tag";
            ball.textContent = n;
            ballsRow.appendChild(ball);
          });

          card.appendChild(header);
          card.appendChild(ballsRow);
          othersContainer.appendChild(card);
        });
      } else {
        othersContainer.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            Ainda não há outros jogos registrados no momento.
          </div>
        `;
      }
    }
  },

  createGameCardEl: function(title, dezenasStr) {
    const card = document.createElement("div");
    card.className = "game-card";

    const header = document.createElement("div");
    header.className = "game-card-header";
    header.innerHTML = `<strong>${title}</strong>`;

    const ballsRow = document.createElement("div");
    ballsRow.className = "selected-balls-row";
    const nums = (dezenasStr || "").split(",").map(s => s.trim());
    nums.forEach(n => {
      const ball = document.createElement("span");
      ball.className = "ball-tag";
      ball.textContent = n;
      ballsRow.appendChild(ball);
    });

    card.appendChild(header);
    card.appendChild(ballsRow);
    return card;
  },

  switchDashTab: function(tab) {
    document.getElementById("tabDashMyGames").classList.toggle("active", tab === "my");
    document.getElementById("tabDashBolaoGames").classList.toggle("active", tab === "bolao");
    document.getElementById("tabDashOtherGames").classList.toggle("active", tab === "others");

    document.getElementById("dashSecMyGames").style.display = (tab === "my") ? "block" : "none";
    document.getElementById("dashSecBolaoGames").style.display = (tab === "bolao") ? "block" : "none";
    document.getElementById("dashSecOtherGames").style.display = (tab === "others") ? "block" : "none";
  },

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================
  formatPhone: function(p) {
    if (!p) return "";
    const clean = p.replace(/\D/g, "");
    if (clean.length === 11) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    }
    return p;
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

  // ==========================================================================
  // RECURSOS PWA (INSTALAÇÃO NO CELULAR)
  // ==========================================================================
  installPwa: async function() {
    if (window.deferredInstallPrompt) {
      window.deferredInstallPrompt.prompt();
      const choiceResult = await window.deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        this.showToast("Instalação iniciada!", "success");
      }
      window.deferredInstallPrompt = null;
      const banner = document.getElementById("pwaInstallBanner");
      if (banner) banner.style.display = "none";
    } else {
      this.showToast("Para instalar: toque no menu do seu navegador (⋮) e selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'.", "info");
    }
  },

  dismissPwaBanner: function() {
    sessionStorage.setItem("pwa_dismissed", "true");
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.style.display = "none";
  },

  dismissIosBanner: function() {
    sessionStorage.setItem("ios_pwa_dismissed", "true");
    const banner = document.getElementById("iosInstallBanner");
    if (banner) banner.style.display = "none";
  },

  checkIosPwa: function() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const banner = document.getElementById("iosInstallBanner");
    if (isIos && !isStandalone && banner && !sessionStorage.getItem("ios_pwa_dismissed")) {
      banner.style.display = "flex";
    }
  },

  // ============================================================================
  // DOWNLOAD DE COMPROVANTE PDF (participante)
  // ============================================================================
  async downloadMyReceiptPDF() {
    if (!this.currentUser) {
      this.showToast("Nenhum usuário logado.", "error");
      return;
    }
    if (!this.dashboardData || !this.dashboardData.myGames || this.dashboardData.myGames.length === 0) {
      this.showToast("Você ainda não cadastrou seus 5 palpites.", "error");
      return;
    }
    if (typeof PdfGenerator === "undefined" || typeof window.jspdf === "undefined") {
      this.showToast("Aguarde o carregamento completo da página e tente novamente.", "error");
      return;
    }
    this.showToast("Gerando comprovante PDF...", "info");
    setTimeout(() => {
      PdfGenerator.generateReceiptPdf(
        this.currentUser.name || "Participante",
        this.currentUser.phone || "",
        this.dashboardData.myGames
      );
    }, 200);
  }
};

// ============================================================================
// EVENTOS PWA (SERVICE WORKER E CAPTURA DE INSTALAÇÃO)
// ============================================================================
window.deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  const banner = document.getElementById("pwaInstallBanner");
  if (banner && !sessionStorage.getItem("pwa_dismissed")) {
    banner.style.display = "flex";
  }
});

window.addEventListener("appinstalled", () => {
  window.deferredInstallPrompt = null;
  const banner = document.getElementById("pwaInstallBanner");
  if (banner) banner.style.display = "none";
  App.showToast("Aplicativo instalado com sucesso na sua tela inicial!", "success");
});

// Registra Service Worker se suportado
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Aviso ao registrar ServiceWorker:", err);
    });
  });
}

// Dispara inicialização quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => App.init());
