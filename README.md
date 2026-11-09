# 🍀 Bolão da Mega da Virada — Família & Amigos

Site para organizar o bolão da Mega da Virada entre familiares e amigos.

- **Frontend:** HTML, CSS e JavaScript puro em módulos ES — publicado no **GitHub Pages**. Usa o mesmo design system do *Bolão Mega Sena* (tema claro/escuro automático, fonte Inter).
- **Backend:** **Google Apps Script** ligado a uma **Planilha Google** (abas `Participantes`, `Jogos`, `JogosBolao` e `Config`).

---

## Funcionalidades

### Participante (`index.html`)
- **Login** com WhatsApp + data de nascimento; **cadastro** com aceite das regras.
- **Escolha dos 5 jogos** no volante de 60 dezenas: exatamente 6 por jogo, bloqueio de jogos idênticos, **surpresinha** que completa só as dezenas que faltam, navegação livre entre os jogos e tela de revisão.
- **Pagamento via PIX**: valor da cota e divisão transparente (R$ 30 dos 5 jogos + R$ 15 para o fundo de jogos especiais), chave com botão de copiar (vem da aba `Config`) e botão “Já paguei” que avisa o organizador por e-mail.
- **Painel**: status do pagamento e do bolão, seus 5 jogos (com **comprovante em PDF**), jogos especiais do bolão (7–9 dezenas em destaque dourado) e todos os jogos do grupo sem nomes/telefones.
- Instalável como app (PWA).

### Organizador (`admin.html`)
- Acesso por senha (aba `Config` → `AdminPassword`).
- Métricas: participantes, pagos, pendentes, valor arrecadado, fundo e total de jogos a registrar.
- Participantes: busca por nome/telefone, filtro por status, **dar baixa** / desfazer e ver os jogos de cada um.
- **Jogos oficiais** de 6, 7, 8 ou 9 dezenas, com surpresinha.
- **Exportação TXT/PDF** de todos os jogos (oficiais + participantes **pagos**; opcionalmente os pendentes). O TXT tem um jogo por linha (`02,07,15,23,28,50`).
- Fechar/reabrir o bolão e confirmar o registro na loteria (avisa todos no painel).
- Configuração da chave PIX e do e-mail de notificações.

---

## Testar localmente (modo demonstração)

1. Em `js/config.js`, deixe `API_URL = ""` (os dados ficam no `localStorage`).
2. Sirva a pasta com um servidor local — módulos ES **não funcionam** abrindo o arquivo com duplo clique:
   ```bash
   python -m http.server 8000
   # ou: npx serve .
   ```
3. Acesse `http://localhost:8000`. Participante de exemplo: `(11) 98765-4321` / `15/05/1985`. Senha do organizador no modo demo: `adminmega2025`.

---

## Configurar o backend (Google Apps Script)

O código do backend (`code.gs`) **não fica neste repositório** (ele é público). Para montar do zero:

1. Crie uma planilha em [sheets.new](https://sheets.new) e abra **Extensões → Apps Script**.
2. Cole o conteúdo do `code.gs` e salve.
3. Execute a função **`setupSpreadsheet`** uma vez (cria as abas e a `Config` com valores padrão) e autorize o acesso.
4. Na aba `Config`, ajuste `AdminPassword`, `PixChave`, `PixTipo`, `PixNome`, `EmailNotificacao` e `ValorTotal`.
5. **Implantar → Nova implantação → App da Web**, executar como **Eu** e acesso **Qualquer pessoa**.
6. Copie a URL `.../exec` para `API_URL` em `js/config.js`.

> Ao alterar o `code.gs`, publique uma **nova versão** da implantação existente (Gerenciar implantações → Editar → Nova versão) para manter a mesma URL.

A data do sorteio e a data de registro dos jogos ficam em `EDICAO`, em `js/config.js`.

---

## Publicar no GitHub Pages

Em **Settings → Pages**, selecione a branch `main` e a pasta `/(root)`. Depois de cada atualização, o service worker (`sw.js`, estratégia “rede primeiro”) entrega a versão nova na próxima abertura do app.

---

## Estrutura

```
index.html            Participante: login, cadastro, 5 jogos, PIX e painel
admin.html            Painel do organizador
manifest.json, sw.js  PWA
css/styles.css        Design system (mesmo do Bolão Mega Sena) + componentes da Virada
js/
  config.js           URL da API, edição, valores da cota
  api.js              Chamada ao Apps Script (timeout, barra de progresso, modo demo)
  mock.js             Simulador do backend para o modo demonstração
  state.js            Estado e sessão
  utils.js            HTML seguro (escape automático), máscaras, formatação
  ui.js               Views, toasts, diálogos, bolinhas e volante de 60 dezenas
  participante.js     Fluxo do participante
  admin.js            Fluxo do organizador
  pdf.js              Comprovante e lista completa em PDF (jsPDF)
  pwa.js              Instalação e service worker
  main.js             Entrada do index.html
  admin-main.js       Entrada do admin.html
```

## Privacidade

Os participantes nunca veem nomes ou telefones dos outros — apenas as dezenas. Só o organizador, com a senha, dá baixa nos pagamentos e cadastra os jogos oficiais.
