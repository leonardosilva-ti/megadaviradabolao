/**
 * CAMADA DE COMUNICAÇÃO COM O BACKEND (GOOGLE APPS SCRIPT / MOCK)
 * 
 * Se CONFIG.API_URL estiver preenchido, envia requisições HTTPS reais ao Web App do Apps Script.
 * Se CONFIG.API_URL estiver vazio, roda automaticamente em MODO LOCAL MOCK (LocalStorage)
 * para permitir desenvolvimento, testes offline e demonstração instantânea.
 */

const Api = {
  isMock: function() {
    return !CONFIG.API_URL || CONFIG.API_URL.trim() === "";
  },

  async request(action, data = {}) {
    if (this.isMock()) {
      return MockApi.handle(action, data);
    }

    try {
      const payload = { action, ...data };
      
      // text/plain previne preflight OPTIONS com CORS no Google Apps Script
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Erro ao chamar ação ${action}:`, error);
      return {
        success: false,
        error: `Não foi possível conectar ao servidor (${error.message}). Verifique sua conexão e a URL configurada.`
      };
    }
  },

  // Endpoints do Participante
  login: (phone, birthdate) => Api.request("login", { phone, birthdate }),
  register: (name, phone, birthdate) => Api.request("register", { name, phone, birthdate }),
  saveGames: (participantId, games) => Api.request("saveGames", { participantId, games }),
  confirmPayment: (participantId) => Api.request("confirmPayment", { participantId }),
  getDashboardData: (participantId) => Api.request("getDashboardData", { participantId }),

  // Endpoints do Administrador
  adminLogin: (password) => Api.request("adminLogin", { password }),
  adminGetData: (password) => Api.request("adminGetData", { password }),
  adminUpdatePayment: (password, participantId, status) => Api.request("adminUpdatePayment", { password, participantId, status }),
  adminAddGame: (password, dezenas) => Api.request("adminAddGame", { password, dezenas }),
  adminDeleteGame: (password, gameId) => Api.request("adminDeleteGame", { password, gameId }),
  adminSavePixConfig: (password, config) => Api.request("adminSavePixConfig", { password, ...config }),
  adminCloseBolao: (password) => Api.request("adminCloseBolao", { password }),
  adminOpenBolao: (password) => Api.request("adminOpenBolao", { password }),
  adminConfirmLottery: (password) => Api.request("adminConfirmLottery", { password }),
  adminExportAllJSON: (password) => Api.request("adminExportAllJSON", { password }),
  downloadMyGamesPDF: (participantId) => Api.request("downloadMyGamesPDF", { participantId })
};

// ============================================================================
// SIMULADOR LOCAL (MOCK API PARA TESTES SEM APPS SCRIPT)
// ============================================================================

const MockApi = {
  STORAGE_KEY_PARTICIPANTES: "megadavirada_participantes",
  STORAGE_KEY_JOGOS: "megadavirada_jogos",
  STORAGE_KEY_BOLAO: "megadavirada_bolao",
  STORAGE_KEY_CONFIG: "megadavirada_config",

  init: function() {
    if (!localStorage.getItem(this.STORAGE_KEY_CONFIG)) {
      const initialConfig = {
        pixKey: CONFIG.PIX.chave,
        pixTipo: CONFIG.PIX.tipoChave,
        pixNome: CONFIG.PIX.titular,
        notificationEmail: "",
        valorTotal: CONFIG.PIX.valorTotal
      };
      localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(initialConfig));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PARTICIPANTES)) {
      const sampleParticipants = [
        {
          id: "p-sample-1",
          name: "Carlos Eduardo Silva",
          phone: "11987654321",
          birthdate: "15/05/1985",
          paymentStatus: "Pago",
          createdAt: new Date().toISOString()
        },
        {
          id: "p-sample-2",
          name: "Mariana Souza",
          phone: "21998765432",
          birthdate: "20/11/1992",
          paymentStatus: "Pendente",
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(this.STORAGE_KEY_PARTICIPANTES, JSON.stringify(sampleParticipants));
    }

    if (!localStorage.getItem(this.STORAGE_KEY_JOGOS)) {
      const sampleJogos = [
        { id: "j1", participantId: "p-sample-1", gameNumber: 1, dezenas: "04, 12, 23, 35, 44, 58" },
        { id: "j2", participantId: "p-sample-1", gameNumber: 2, dezenas: "07, 14, 28, 31, 49, 52" },
        { id: "j3", participantId: "p-sample-1", gameNumber: 3, dezenas: "01, 19, 25, 38, 42, 60" },
        { id: "j4", participantId: "p-sample-1", gameNumber: 4, dezenas: "09, 13, 27, 34, 46, 53" },
        { id: "j5", participantId: "p-sample-1", gameNumber: 5, dezenas: "03, 11, 22, 39, 47, 57" },
        { id: "j6", participantId: "p-sample-2", gameNumber: 1, dezenas: "02, 16, 24, 37, 45, 59" }
      ];
      localStorage.setItem(this.STORAGE_KEY_JOGOS, JSON.stringify(sampleJogos));
    }

    if (!localStorage.getItem(this.STORAGE_KEY_BOLAO)) {
      const sampleBolao = [
        {
          id: "b1",
          qtdDezenas: 8,
          dezenas: "05, 10, 18, 26, 33, 42, 51, 60",
          tipo: "Super Jogo Oficial (8 dezenas)",
          data: new Date().toISOString()
        },
        {
          id: "b2",
          qtdDezenas: 7,
          dezenas: "03, 14, 22, 38, 45, 50, 58",
          tipo: "Jogo Oficial do Bolão (7 dezenas)",
          data: new Date().toISOString()
        }
      ];
      localStorage.setItem(this.STORAGE_KEY_BOLAO, JSON.stringify(sampleBolao));
    }
  },

  getParts: function() {
    this.init();
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY_PARTICIPANTES) || "[]");
  },
  saveParts: function(list) {
    localStorage.setItem(this.STORAGE_KEY_PARTICIPANTES, JSON.stringify(list));
  },
  getJogos: function() {
    this.init();
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY_JOGOS) || "[]");
  },
  saveJogos: function(list) {
    localStorage.setItem(this.STORAGE_KEY_JOGOS, JSON.stringify(list));
  },
  getBolao: function() {
    this.init();
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY_BOLAO) || "[]");
  },
  saveBolao: function(list) {
    localStorage.setItem(this.STORAGE_KEY_BOLAO, JSON.stringify(list));
  },
  getConfig: function() {
    this.init();
    const saved = localStorage.getItem(this.STORAGE_KEY_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          pixKey: parsed.pixKey || CONFIG.PIX.chave,
          pixTipo: parsed.pixTipo || CONFIG.PIX.tipoChave,
          pixNome: parsed.pixNome || CONFIG.PIX.titular,
          notificationEmail: parsed.notificationEmail || "",
          valorTotal: parsed.valorTotal || CONFIG.PIX.valorTotal,
          StatusBolao: parsed.StatusBolao || "Aberto",
          RegistroLoteria: parsed.RegistroLoteria || "false"
        };
      } catch(e) {}
    }
    return {
      pixKey: CONFIG.PIX.chave,
      pixTipo: CONFIG.PIX.tipoChave,
      pixNome: CONFIG.PIX.titular,
      notificationEmail: "",
      valorTotal: CONFIG.PIX.valorTotal,
      StatusBolao: "Aberto",
      RegistroLoteria: "false"
    };
  },
  saveConfig: function(cfg) {
    localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(cfg));
    if (cfg.pixKey) CONFIG.PIX.chave = cfg.pixKey;
    if (cfg.pixTipo) CONFIG.PIX.tipoChave = cfg.pixTipo;
    if (cfg.pixNome) CONFIG.PIX.titular = cfg.pixNome;
  },

  async handle(action, data) {
    // Simula pequeno delay de rede para realismo visual nos loaders
    await new Promise(r => setTimeout(r, 200));

    switch (action) {
      case "login": {
        const phone = (data.phone || "").replace(/\D/g, "");
        const birthdate = (data.birthdate || "").trim();
        const parts = this.getParts();
        const found = parts.find(p => p.phone.replace(/\D/g, "") === phone && p.birthdate === birthdate);

        if (found) {
          const userGames = this.getJogos().filter(j => j.participantId === found.id);
          return {
            success: true,
            user: {
              id: found.id,
              name: found.name,
              phone: found.phone,
              birthdate: found.birthdate,
              paymentStatus: found.paymentStatus,
              hasGames: userGames.length >= 5,
              games: userGames
            }
          };
        }
        return { success: false, notFound: true, message: "Participante não encontrado com esses dados." };
      }

      case "register": {
        // Bloqueia cadastro quando bolão está fechado
        const cfgReg = this.getConfig();
        if (cfgReg.StatusBolao === "Fechado") {
          return { success: false, error: "O bolão está fechado para novos cadastros." };
        }

        const name = (data.name || "").trim();
        const phone = (data.phone || "").replace(/\D/g, "");
        const birthdate = (data.birthdate || "").trim();

        if (!name || !phone || !birthdate) {
          return { success: false, error: "Nome, telefone e data de nascimento são obrigatórios." };
        }

        const parts = this.getParts();
        if (parts.some(p => p.phone.replace(/\D/g, "") === phone)) {
          return { success: false, error: "Este número de telefone já está cadastrado. Faça login." };
        }

        const newUser = {
          id: "p-" + Date.now(),
          name: name,
          phone: phone,
          birthdate: birthdate,
          paymentStatus: "Pendente",
          createdAt: new Date().toISOString()
        };
        parts.push(newUser);
        this.saveParts(parts);

        return {
          success: true,
          user: {
            ...newUser,
            hasGames: false,
            games: []
          }
        };
      }

      case "saveGames": {
        const { participantId, games } = data;
        if (!participantId || !games || games.length !== 5) {
          return { success: false, error: "Envie exatamente 5 jogos." };
        }

        const formattedGames = [];
        for (let i = 0; i < games.length; i++) {
          const sorted = [...games[i]].map(Number).sort((a, b) => a - b);
          const str = sorted.map(n => (n < 10 ? "0" + n : "" + n)).join(", ");
          formattedGames.push(str);
        }

        // Verifica duplicidade entre os 5
        for (let i = 0; i < formattedGames.length; i++) {
          for (let j = i + 1; j < formattedGames.length; j++) {
            if (formattedGames[i] === formattedGames[j]) {
              return { success: false, error: `O Jogo ${i + 1} e o Jogo ${j + 1} são idênticos!` };
            }
          }
        }

        // Remove jogos antigos deste participante
        let allJogos = this.getJogos().filter(j => j.participantId !== participantId);

        // Adiciona os 5 novos
        formattedGames.forEach((dez, idx) => {
          allJogos.push({
            id: "j-" + participantId + "-" + (idx + 1),
            participantId: participantId,
            gameNumber: idx + 1,
            dezenas: dez
          });
        });

        this.saveJogos(allJogos);
        return { success: true, message: "Jogos gravados com sucesso!", games: formattedGames };
      }

      case "confirmPayment": {
        // Bloqueia confirmação de pagamento se bolão estiver fechado
        const cfgPay = this.getConfig();
        if (cfgPay.StatusBolao === "Fechado") {
          // Verifica se o participante já é pago
          const partsCheck = this.getParts();
          const userCheck = partsCheck.find(p => p.id === data.participantId);
          if (!userCheck || (userCheck.paymentStatus || "").toLowerCase() !== "pago") {
            return { success: false, error: "O bolão está fechado. Não é mais possível confirmar pagamentos." };
          }
        }
        return { success: true, message: "Pagamento informado com sucesso. Aguardando conferência do organizador." };
      }

      case "getDashboardData": {
        const participantId = data.participantId;
        const parts = this.getParts();
        const user = parts.find(p => p.id === participantId);

        const allJogos = this.getJogos();
        const myGames = allJogos.filter(j => j.participantId === participantId);
        // Outros jogos de forma anônima
        const otherGames = allJogos
          .filter(j => j.participantId !== participantId)
          .map(j => ({ dezenas: j.dezenas, data: new Date().toISOString() }));

        const bolaoGames = this.getBolao();

        return {
          success: true,
          user: user || null,
          myGames: myGames,
          otherGames: otherGames,
          bolaoGames: bolaoGames,
          config: this.getConfig()
        };
      }

      case "adminLogin": {
        const pass = (data.password || "").trim();
        if (pass === CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: true, message: "Acesso administrativo concedido." };
        }
        return { success: false, error: "Senha de administrador incorreta." };
      }

      case "adminGetData": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }

        const parts = this.getParts();
        const allJogos = this.getJogos();
        const bolaoGames = this.getBolao();

        const participantsWithGames = parts.map(p => {
          const pGames = allJogos.filter(j => j.participantId === p.id);
          return {
            ...p,
            gamesCount: pGames.length,
            games: pGames
          };
        });

        return {
          success: true,
          participants: participantsWithGames,
          bolaoGames: bolaoGames,
          config: this.getConfig()
        };
      }

      case "adminUpdatePayment": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }

        const parts = this.getParts();
        const idx = parts.findIndex(p => p.id === data.participantId);
        if (idx !== -1) {
          parts[idx].paymentStatus = data.status;
          this.saveParts(parts);
          return { success: true, message: `Status alterado para ${data.status}` };
        }
        return { success: false, error: "Participante não encontrado." };
      }

      case "adminAddGame": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }

        const dezenas = data.dezenas || [];
        const len = dezenas.length;
        if (len < 6 || len > 9) {
          return { success: false, error: "O jogo deve ter 6, 7, 8 ou 9 dezenas." };
        }

        const sorted = [...dezenas].map(Number).sort((a, b) => a - b);
        const formatted = sorted.map(n => (n < 10 ? "0" + n : "" + n)).join(", ");

        const bolaoGames = this.getBolao();
        const newGame = {
          id: "b-" + Date.now(),
          qtdDezenas: len,
          dezenas: formatted,
          tipo: `Jogo Oficial (${len} dezenas)`,
          data: new Date().toISOString()
        };

        bolaoGames.unshift(newGame);
        this.saveBolao(bolaoGames);

        return { success: true, message: "Super jogo cadastrado!", game: newGame };
      }

      case "adminDeleteGame": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }

        let bolaoGames = this.getBolao();
        const initialLen = bolaoGames.length;
        bolaoGames = bolaoGames.filter(g => g.id !== data.gameId);

        if (bolaoGames.length < initialLen) {
          this.saveBolao(bolaoGames);
          return { success: true, message: "Jogo removido com sucesso." };
        }
        return { success: false, error: "Jogo não encontrado." };
      }

      case "adminSavePixConfig": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }
        const pixKey = (data.pixKey || "").trim();
        const pixTipo = (data.pixTipo || "").trim() || "E-mail";
        const pixNome = (data.pixNome || "").trim() || CONFIG.PIX.titular;
        const notificationEmail = (data.notificationEmail || "").trim();

        if (!pixKey) {
          return { success: false, error: "A chave PIX não pode ficar vazia." };
        }

        const newConfig = {
          ...this.getConfig(),
          pixKey: pixKey,
          pixTipo: pixTipo,
          pixNome: pixNome,
          notificationEmail: notificationEmail
        };
        this.saveConfig(newConfig);

        return {
          success: true,
          message: "Configurações (PIX e Notificações) atualizadas com sucesso!",
          config: newConfig
        };
      }

      case "adminCloseBolao": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }
        const cfg = this.getConfig();
        cfg.StatusBolao = "Fechado";
        this.saveConfig(cfg);
        return { success: true, message: "Bolão fechado com sucesso.", StatusBolao: "Fechado" };
      }

      case "adminOpenBolao": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }
        const cfg = this.getConfig();
        cfg.StatusBolao = "Aberto";
        this.saveConfig(cfg);
        return { success: true, message: "Bolão reaberto!", StatusBolao: "Aberto" };
      }

      case "adminConfirmLottery": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }
        const cfg = this.getConfig();
        cfg.StatusBolao = "Fechado";
        cfg.RegistroLoteria = "true";
        this.saveConfig(cfg);
        return {
          success: true,
          message: "Registro na loteria confirmado! Bolão fechado.",
          StatusBolao: "Fechado",
          RegistroLoteria: "true"
        };
      }

      case "adminExportAllJSON": {
        if ((data.password || "").trim() !== CONFIG.ADMIN_SENHA_PADRAO) {
          return { success: false, error: "Acesso não autorizado." };
        }
        const parts = this.getParts();
        const allJogos = this.getJogos();
        const lines = allJogos.map(j => {
          const p = parts.find(pt => pt.id === j.participantId);
          return {
            participantName: p ? p.name : "Desconhecido",
            paymentStatus: p ? p.paymentStatus : "Pendente",
            gameNumber: j.gameNumber,
            dezenas: j.dezenas
          };
        });
        return { success: true, games: lines };
      }

      case "downloadMyGamesPDF": {
        const participantId = data.participantId;
        const parts = this.getParts();
        const p = parts.find(pt => pt.id === participantId);
        const myGames = this.getJogos().filter(j => j.participantId === participantId);
        return {
          success: true,
          participantName: p ? p.name : "Participante",
          games: myGames
        };
      }

      default:
        return { success: false, error: "Ação mock não encontrada." };
    }
  }
};
