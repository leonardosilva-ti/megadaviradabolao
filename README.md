# 🍀 Bolão da Mega da Virada — Família & Amigos

Site para organizar o bolão da Mega da Virada entre familiares e amigos.

- **Frontend:** HTML, CSS e JavaScript puro em módulos ES — publicado no **GitHub Pages**. Usa o mesmo design system do *Bolão Mega Sena* (tema claro/escuro automático, fonte Inter).
- **Backend:** **Google Apps Script** ligado a uma **Planilha Google** (abas `Participantes`, `Jogos`, `JogosBolao` e `Config`).

---

## Funcionalidades

### Participante (`index.html`)
- **Login** com WhatsApp + data de nascimento; **cadastro** com aceite das regras.
- **Escolha dos 5 jogos** no volante de 60 dezenas: exatamente 6 por jogo, bloqueio de jogos idênticos, **surpresinha** que completa só as dezenas que faltam, navegação livre entre os jogos e tela de revisão.
- **Pagamento via PIX** logo após o cadastro, com opção **“Pagar depois”**: valor da cota e divisão transparente (R$ 60 = R$ 30 dos 5 jogos + R$ 30 para o fundo de jogos especiais), chave com botão de copiar, titular e instituição (vêm da aba `Config`), prazo de pagamento (28/12 às 12h; jogos registrados e bolão fechado às 18h) e botão “Já paguei” que avisa o organizador por e-mail.
- **Convite para amigos** ao final do cadastro e no painel: mensagem pronta (com o prêmio estimado e o link do site) para WhatsApp, qualquer outro app ou copiar.
- **Painel**: status do pagamento e do bolão, seus 5 jogos (com **comprovante em PDF** e botão **Editar**, liberado até o fechamento do bolão — `EDICAO.prazoAlteracao` no `js/config.js` e `PRAZO_ALTERACAO_JOGOS` no `code.gs`, ou antes se o organizador fechar o bolão), jogos especiais do bolão (7–9 dezenas em destaque dourado) e todos os jogos do grupo sem nomes/telefones (com aviso de que podem mudar até o fechamento).
- **Depois do fechamento do bolão**: conferência do resultado (os próprios jogos, os jogos especiais e os dos demais participantes pagos, com 4+ acertos) e **PDF com todos os jogos** registrados.
- Instalável como app (PWA).
- **Modo claro/escuro** pelo botão 🌙/☀️ no cabeçalho (site e painel do organizador). Sem escolha, segue o tema do aparelho.

### Organizador (`admin.html`)
- Acesso por senha, guardada na propriedade do script `AdminPass` (fora da planilha).
- Métricas: participantes, pagos, pendentes, valor arrecadado (inclui pagamentos parciais), fundo e total de jogos a registrar.
- **Pagamento em partes** (botão “💵 Valores”): lance cada valor recebido, com observação; o histórico fica na aba `Pagamentos` da planilha. Quando a soma chega ao valor da cota, o participante vira “Pago” automaticamente. “Dar baixa” registra o que falta como *Quitação* e “Voltar p/ pendente” remove só essa quitação. O participante vê no painel quanto já pagou e quanto falta, e pode avisar um **pagamento parcial** (“Paguei só uma parte”): o organizador recebe e-mail e o aviso aparece na tabela (📨 informou R$ X) e já preenchido em “💵 Valores” (coluna `AvisoPagamento` da aba Participantes).
- Participantes: busca por nome/telefone, filtro por status, **dar baixa** / desfazer, ver os jogos de cada um e **excluir** o participante (remove também os jogos dele).
- **Jogos oficiais** de 6, 7, 8 ou 9 dezenas, com surpresinha.
- **Exportação TXT/PDF** de todos os jogos (oficiais + participantes **pagos**; opcionalmente os pendentes). O TXT tem um jogo por linha (`02,07,15,23,28,50`).
- Fechar/reabrir o bolão e confirmar o registro na loteria (avisa todos no painel).
- **Conferência do resultado**: digite as 6 dezenas sorteadas e veja os jogos (oficiais + participantes pagos) com 4 ou mais acertos. Nos jogos de 7 a 9 dezenas mostra quantas senas, quinas e quadras o jogo vale.
- Configuração da chave PIX (tipo, titular e instituição), do **valor da cota**, do **WhatsApp do organizador** (botão “Tirar dúvidas” no login, cadastro, pagamento e painel do participante) e do e-mail de notificações.

---

## Segurança

- **Site (GitHub Pages):** HTTPS obrigatório; política de segurança (CSP) que só permite scripts do próprio site e do cdnjs; jsPDF carregado com verificação de integridade (SRI); página do participante fora dos buscadores (`noindex`).
- **API (Apps Script):** a URL é pública, então tudo é validado no servidor. Limites de tentativas (CacheService): senha do organizador (10 erros em 15 min bloqueiam o painel por 15 min e enviam alerta por e-mail), login do participante (5 datas erradas por celular em 15 min), cadastros (30 por hora), avisos de pagamento (6 por participante por hora) e e-mails de notificação (40 a cada 6 h; alertas de segurança sempre passam).
- **Planilha:** textos digitados por participantes são gravados como texto puro (sem injeção de fórmula) e escapados nos e-mails.
- **PIX:** qualquer alteração da chave, titular, banco ou do e-mail de notificação gera alerta enviado ao e-mail **anterior** (e ao novo, se mudou).
- **Senha do organizador:** só na propriedade do script `AdminPass` (nunca no repositório nem na planilha).
- **Sessões assinadas (HMAC-SHA256):** a senha do organizador só é usada no login, que devolve um passe válido por 8 h (o navegador guarda só o passe). O login do participante devolve um passe de 30 dias, e as ações dele usam o ID que está dentro do passe. O segredo fica na propriedade do script `SessionSecret` (criada sozinha); **apagar ou trocar essa propriedade derruba todas as sessões**.
- **Backup diário:** execute `instalarBackupDiario()` uma vez no editor do Apps Script. Toda madrugada (3h) uma cópia da planilha vai para a pasta “Backups - Bolão Mega da Virada” no Drive; ficam as 7 mais recentes.

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
4. Em **Configurações do projeto (⚙️) → Propriedades do script**, crie a propriedade `AdminPass` com a senha do organizador (sem ela o painel fica bloqueado). Na aba `Config`, ajuste `PixChave`, `PixTipo`, `PixNome`, `EmailNotificacao` e `ValorTotal`.
5. **Implantar → Nova implantação → App da Web**, executar como **Eu** e acesso **Qualquer pessoa**.
6. Copie a URL `.../exec` para `API_URL` em `js/config.js`.

> Ao alterar o `code.gs`, publique uma **nova versão** da implantação existente (Gerenciar implantações → Editar → Nova versão) para manter a mesma URL.

A data do sorteio, o prazo de pagamento, o horário de registro dos jogos e o prêmio estimado (usado no convite) ficam em `EDICAO`, em `js/config.js`.

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
  convite.js          Convite para amigos (WhatsApp, outros apps, copiar)
  pwa.js              Instalação e service worker
  main.js             Entrada do index.html
  admin-main.js       Entrada do admin.html
```

## Privacidade

Os participantes nunca veem nomes ou telefones dos outros — apenas as dezenas. Só o organizador, com a senha, dá baixa nos pagamentos e cadastra os jogos oficiais.
