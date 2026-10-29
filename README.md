# 🍀 Bolão da Mega da Virada - Família & Amigos

Sistema web completo para organizar e gerenciar um bolão da Mega da Virada com familiares e amigos.
- **Frontend:** HTML5, CSS3 moderno (tema verde e ouro) e JavaScript puro (compatível 100% com **GitHub Pages**).
- **Backend:** **Google Apps Script** conectado a uma **Planilha Google** gratuita como banco de dados.

---

## 🌟 Funcionalidades do Sistema

### 👤 Para o Participante (`index.html`)
- **Acesso/Login**: Número de WhatsApp/Celular e Data de Nascimento (sem necessidade de senhas complexas).
- **Novo Cadastro**: Se não tiver cadastro, preenche Nome, Telefone e Data de Nascimento.
- **Wizard de 5 Jogos com 60 Bolinhas**:
  - Interface interativa com 60 dezenas (01 a 60) no estilo oficial das loterias.
  - Seleção obrigatória de exatamente 6 números por jogo (1 a 5).
  - **Validação de Duplicidade:** Impede que o participante cadastre dois jogos com as mesmas dezenas.
  - **Surpresinha Inteligente:** Se você já selecionou alguns números (ex: 2 dezenas favoritas) e clicar em Surpresinha, o sistema preserva seus números e completa apenas os que faltam! Se nenhum número foi escolhido, gera todos os 6.
  - Botão de **Limpar** e navegação entre passos (Jogo 1 a 5) com possibilidade de voltar e alterar antes de confirmar.
- **Tela de Pagamento PIX Transparente**:
  - Exibe o valor total da cota: **R$ 45,00**.
  - **Detalhamento transparente:**
    - **R$ 30,00:** Paga os 5 jogos individuais do participante (5 x R$ 6,00 da aposta simples).
    - **R$ 15,00:** Destinado ao **fundo comunitário do bolão** para fazer super-jogos com 7, 8 ou 9 números.
  - Chave PIX com botão de copiar em 1 clique.
  - Botão de confirmação de pagamento para avisar a administração.
- **Painel do Participante (Dashboard)**:
  - Status do pagamento (**Pendente** ou **Pago**).
  - **Botão de Confirmação Rápida:** Caso o pagamento ainda esteja com o status Pendente, o participante pode clicar diretamente em **"✓ Já paguei via Pix"** para notificar a organização.
  - Visualização dos seus 5 jogos registrados.
  - **Super Jogos Oficiais do Bolão:** Apostas feitas pela administração com **destaque visual dourado especial** para jogos com mais de 6 dezenas (7, 8 ou 9).
  - **Transparência Comunitária:** Exibe todas as dezenas jogadas pelos outros participantes, **sem expor nomes ou telefones** (privacidade total).

---

### 👑 Para o Organizador / Administração (`admin.html`)
- Acesso protegido por senha administrativa (padrão: `adminmega2025`).
- **Métricas em tempo real:** Total de participantes, pagamentos confirmados, pagamentos pendentes e saldo do fundo comunitário para super jogos.
- **Configuração da Chave PIX em Tempo Real:** Aba dedicada no painel para alterar a Chave Pix, o tipo de chave (CPF, e-mail, celular, aleatória) e o nome do titular sem precisar mexer em código!
- **Gestão de Participantes:**
  - Busca por nome ou telefone.
  - Filtro por status (Todos / Pagos / Pendentes).
  - **Dar baixa no pagamento** com 1 clique (alterna entre Pago e Pendente).
  - Visualização detalhada dos 5 jogos de qualquer participante.
- **Cadastro de Jogos Oficiais do Bolão:**
  - Seletor flexível para cadastrar jogos com **6, 7, 8 ou 9 dezenas** (com Surpresinha inteligente para completar).
  - Grade com 60 dezenas e controle de limite pelo tamanho escolhido.
  - Jogos com mais de 6 dezenas aparecem automaticamente em destaque dourado para todos os membros.
  - Opção para excluir jogos oficiais se necessário.

---

## 🚀 Como Testar Imediatamente no Computador (Modo Demonstração)

O projeto foi construído com um **simulador inteligente offline (Mock)**:
1. Abra a pasta `bola-mega-da-virada`.
2. Dê um duplo clique no arquivo `index.html` para abrir diretamente no seu navegador (Google Chrome, Edge, Safari, etc.).
3. O sistema detectará automaticamente que a API do Google Sheets ainda não foi configurada e ativará o **Modo Demonstração Local**, gravando os dados no `localStorage` do seu navegador.
4. Para acessar a área de administração localmente, acesse `admin.html` e utilize a senha: `adminmega2025`.

---

## 📋 Como Configurar o Backend no Google Planilhas (Apps Script)

Siga este passo a passo simples de 5 minutos para criar seu banco de dados na nuvem:

### Passo 1: Criar a Planilha Google
1. Acesse [sheets.new](https://sheets.new) no seu navegador para criar uma nova Planilha Google.
2. Nomeie a planilha como: `Banco de Dados - Bolão Mega da Virada`.

### Passo 2: Adicionar o Código do Apps Script
1. No menu superior da planilha, clique em **Extensões** > **Apps Script**.
2. Apague qualquer código existente no editor `Código.gs`.
3. Abra o arquivo [google-apps-script/Code.gs](google-apps-script/Code.gs) deste projeto, copie todo o conteúdo e cole no editor do Apps Script.
4. Clique no ícone de salvar (💾) ou pressione `Ctrl + S`.

### Passo 3: Inicializar as Abas da Planilha
1. No topo do editor do Apps Script, na barra de ferramentas onde diz `Executar`, selecione a função **`setupSheets`** no menu suspenso de funções.
2. Clique no botão **Executar**.
3. O Google solicitará permissão para acessar a planilha. Clique em **Revisar permissões** > Escolha sua conta Google > Clique em **Avançado** > Clique em **Acessar (não seguro)** > Clique em **Permitir**.
4. Volte à sua Planilha Google: você verá que as abas **Participantes**, **Jogos**, **JogosBolao** e **Config** foram criadas automaticamente com cores e cabeçalhos!
5. Na aba **Config**, você pode alterar sua Chave Pix, Nome do Titular e Senha de Administrador se desejar.

### Passo 4: Implantar o Aplicativo da Web
1. No editor do Apps Script, clique no botão azul **Implantar** (canto superior direito) > **Nova implantação**.
2. Clique no ícone de engrenagem ⚙️ (ao lado de 'Selecionar tipo') e escolha **App da Web**.
3. Preencha as configurações exatamente assim:
   - **Descrição:** `API Bolão Mega da Virada`
   - **Executar como:** `Eu (seu-email@gmail.com)`
   - **Quem tem acesso:** `Qualquer pessoa` *(MUITO IMPORTANTE: deve ser 'Qualquer pessoa' para que os participantes consigam enviar os jogos pelo GitHub Pages sem precisar de login no Google).*
4. Clique em **Implantar**.
5. Copie a **URL do app da Web** gerada (algo parecido com `https://script.google.com/macros/s/AKfycby.../exec`).

### Passo 5: Conectar o Frontend à sua Planilha
1. Abra o arquivo `js/config.js` no seu editor de código.
2. Na propriedade `API_URL`, cole a URL que você acabou de copiar:
   ```javascript
   API_URL: "https://script.google.com/macros/s/AKfycby.../exec",
   ```
3. No mesmo arquivo, ajuste também sua chave PIX:
   ```javascript
   PIX: {
     chave: "suachavepix@banco.com.br",
     tipoChave: "E-mail", // ou "CPF", "Telefone", "Chave Aleatória"
     titular: "Seu Nome Completo",
     cidade: "Sua Cidade",
     valorTotal: 45.00,
     ...
   }
   ```
4. Salve o arquivo `js/config.js`. Pronto! O site agora está conectado à sua planilha oficial em tempo real.

---

## 🌐 Como Publicar Gratuitamente no GitHub Pages

1. Crie um repositório no seu GitHub (exemplo: `bolao-mega-da-virada`).
2. Suba todos os arquivos desta pasta para o repositório:
   - `index.html`
   - `admin.html`
   - pasta `css/`
   - pasta `js/`
3. No GitHub, vá na aba **Settings** do seu repositório.
4. No menu lateral esquerdo, clique em **Pages**.
5. Em **Build and deployment** > **Branch**, selecione `main` (ou `master`) e a pasta `/(root)`.
6. Clique em **Save**.
7. Em cerca de 1 minuto, o GitHub gerará o seu link público:
   `https://seu-usuario.github.io/bolao-mega-da-virada/`
8. Compartilhe o link no WhatsApp da família e amigos!

---

## 📁 Estrutura do Projeto

```
bola-mega-da-virada/
│
├── index.html                  # Interface do participante (Login, Wizard, Pix e Dashboard)
├── admin.html                  # Painel de controle e cadastro de super-jogos da organização
│
├── css/
│   └── style.css               # Folha de estilos temática verde e ouro, responsiva para celular
│
├── js/
│   ├── config.js               # Configuração da URL da API, Chave Pix e Senha Admin
│   ├── api.js                  # Integração com Apps Script e simulador offline local
│   ├── app.js                  # Lógica do participante, 60 bolinhas, surpresinha e validação
│   └── admin.js                # Lógica do administrador, baixa de pagamentos e jogos 6 a 9
│
├── google-apps-script/
│   └── Code.gs                 # Código backend para colar no Google Apps Script
│
└── README.md                   # Este manual de instruções
```

---

## 🛡️ Segurança e Privacidade
- Os participantes nunca têm acesso aos dados pessoais de outros participantes (telefones, nomes e CPFs não são exibidos na lista de outros jogos).
- Apenas o organizador que possui a senha de administrador pode dar baixa nos pagamentos e cadastrar os jogos oficiais do bolão.
