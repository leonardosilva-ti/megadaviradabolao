/**
 * Geração de PDF no navegador com jsPDF (carregado via CDN em <script> no HTML).
 * Obs.: as fontes padrão do jsPDF não têm emoji, então os textos aqui são só texto.
 */
import { EDICAO } from "./config.js";
import { formatPhone, parseDezenas } from "./utils.js";

const VERDE = [20, 83, 45];
const VERDE_CLARO = [236, 253, 243];
const OURO = [161, 98, 7];
const CINZA = [90, 100, 90];

// A biblioteca (≈360 KB) só é baixada quando alguém gera um PDF, não em toda abertura do site.
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const JSPDF_SRI = "sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==";
let carregando = null;

/** Carrega o jsPDF uma vez (com verificação de integridade) e devolve a classe jsPDF. */
export function carregarJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  carregando ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JSPDF_URL;
    script.integrity = JSPDF_SRI;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("Biblioteca de PDF inválida.")));
    script.onerror = () => {
      carregando = null; // permite tentar de novo
      script.remove();
      reject(new Error("Não foi possível carregar a biblioteca de PDF. Verifique a conexão e tente novamente."));
    };
    document.head.appendChild(script);
  });
  return carregando;
}

async function novoDocumento() {
  const JsPDF = await carregarJsPDF();
  return new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
}

const nomeArquivo = (texto) =>
  String(texto || "participante").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");

function cabecalho(doc, titulo, subtitulo) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, w, 34, "F");
  doc.setTextColor(253, 224, 71);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titulo, w / 2, 15, { align: "center" });
  doc.setTextColor(230, 240, 230);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(subtitulo, w / 2, 24, { align: "center" });
}

/** Comprovante com os 5 jogos do participante. */
export async function gerarComprovante(user, games) {
  const doc = await novoDocumento();
  const w = doc.internal.pageSize.getWidth();
  const m = 15;

  cabecalho(doc, "Bolão da Mega da Virada", `Comprovante de participação · Sorteio ${EDICAO.dataSorteio} · Gerado em ${new Date().toLocaleString("pt-BR")}`);

  let y = 44;
  doc.setFillColor(...VERDE_CLARO);
  doc.roundedRect(m, y, w - m * 2, 20, 3, 3, "F");
  doc.setTextColor(...CINZA);
  doc.setFontSize(9);
  doc.text("PARTICIPANTE", m + 5, y + 7);
  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(user.name || "Participante"), m + 5, y + 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(formatPhone(user.phone), w - m - 5, y + 14.5, { align: "right" });

  y += 30;
  doc.setTextColor(...VERDE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Seus palpites", m, y);
  y += 6;

  games.forEach((g, i) => {
    doc.setDrawColor(210, 220, 210);
    doc.roundedRect(m, y, w - m * 2, 18, 3, 3, "S");
    doc.setTextColor(...CINZA);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`JOGO ${g.gameNumber || i + 1}`, m + 5, y + 10.5);

    let x = m + 40;
    parseDezenas(g.dezenas).forEach((n) => {
      doc.setFillColor(22, 163, 74);
      doc.circle(x, y + 9, 5.2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(n, x, y + 10.6, { align: "center" });
      x += 14;
    });
    y += 22;
  });

  y += 4;
  doc.setTextColor(...CINZA);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Este comprovante confirma o registro dos seus palpites no bolão privado da família e amigos.", w / 2, y, { align: "center" });
  doc.text(`Os jogos serão registrados na loteria em ${EDICAO.registroJogos}. Bolão sem vínculo com a Caixa Econômica Federal. Boa sorte!`, w / 2, y + 5, { align: "center" });

  doc.save(`Comprovante_${nomeArquivo(user.name)}.pdf`);
}

/**
 * Comprovante com todos os jogos do bolão (liberado ao participante depois do fechamento):
 * os jogos dele, os jogos especiais do organizador e os jogos dos demais participantes (sem nomes).
 */
export async function gerarComprovanteCompleto({ user, meus, meusValem, oficiais, outros }) {
  const doc = await novoDocumento();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 14;
  let pagina = 1;
  const total = (meusValem ? meus.length : 0) + oficiais.length + outros.length;

  cabecalho(doc, "Jogos do Bolão da Mega da Virada",
    `Sorteio ${EDICAO.dataSorteio} · ${total} jogo(s) registrado(s) · Gerado em ${new Date().toLocaleString("pt-BR")}`);

  const rodape = () => {
    doc.setTextColor(...CINZA);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Bolão privado entre família e amigos, sem vínculo com a Caixa Econômica Federal.", m, h - 8);
    doc.text(`Página ${pagina}`, w - m, h - 8, { align: "right" });
  };
  const novaPaginaSePreciso = (altura) => {
    if (y + altura <= h - 16) return;
    rodape();
    doc.addPage();
    pagina++;
    y = 16;
  };

  let y = 44;
  doc.setFillColor(...VERDE_CLARO);
  doc.roundedRect(m, y, w - m * 2, 16, 3, 3, "F");
  doc.setTextColor(...CINZA);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("COMPROVANTE DE", m + 5, y + 6);
  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(String(user?.name || "Participante"), m + 5, y + 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(formatPhone(user?.phone), w - m - 5, y + 12.5, { align: "right" });
  y += 26;

  const titulo = (texto, cor = VERDE) => {
    novaPaginaSePreciso(14);
    doc.setTextColor(...cor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(texto, m, y);
    y += 3;
    doc.setDrawColor(...cor);
    doc.setLineWidth(0.4);
    doc.line(m, y, w - m, y);
    y += 6;
  };

  /** Uma linha por jogo: rótulo à esquerda e dezenas em bolinhas. */
  const linhaJogo = (rotulo, dezenas, cor) => {
    novaPaginaSePreciso(10);
    doc.setTextColor(...CINZA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(rotulo, m + 1, y + 1.2);
    let x = m + 46;
    dezenas.forEach((n) => {
      doc.setFillColor(...cor);
      doc.circle(x, y, 3.6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text(n, x, y + 1.2, { align: "center" });
      x += 9.2;
    });
    y += 9;
  };

  titulo("Seus jogos");
  if (!meus.length) {
    doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text("Você não cadastrou jogos.", m + 1, y); y += 8;
  } else {
    if (!meusValem) {
      doc.setTextColor(180, 35, 24); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Atenção: seus jogos NÃO foram registrados (pagamento não confirmado antes do fechamento).", m + 1, y); y += 7;
    }
    meus.forEach((g, i) => linhaJogo(`JOGO ${g.gameNumber || i + 1}`, parseDezenas(g.dezenas), meusValem ? [22, 163, 74] : [160, 160, 160]));
  }
  y += 3;

  titulo(`Jogos especiais do bolão (${oficiais.length})`, OURO);
  if (!oficiais.length) {
    doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text("Nenhum jogo especial cadastrado.", m + 1, y); y += 8;
  }
  oficiais.forEach((g, i) => {
    const dz = parseDezenas(g.dezenas);
    linhaJogo(`ESPECIAL #${i + 1} (${dz.length})`, dz, [202, 138, 4]);
  });
  y += 3;

  titulo(`Jogos dos demais participantes (${outros.length})`);
  if (!outros.length) {
    doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text("Nenhum outro participante com pagamento confirmado.", m + 1, y); y += 8;
  }
  outros.forEach((g, i) => linhaJogo(`GRUPO #${i + 1}`, parseDezenas(g.dezenas), [21, 128, 61]));

  rodape();
  doc.save(`Jogos_do_Bolao_${nomeArquivo(user?.name)}.pdf`);
}

/**
 * Lista com todos os jogos (admin).
 * @param {{ participantName: string, dezenas: string, oficial?: boolean, paymentStatus?: string }[]} jogos
 */
export async function gerarListaCompleta(jogos) {
  const doc = await novoDocumento();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 12;
  let pagina = 1;

  cabecalho(doc, "Todos os jogos do bolão", `Mega da Virada ${EDICAO.dataSorteio} · ${jogos.length} jogo(s) · Gerado em ${new Date().toLocaleString("pt-BR")}`);
  let y = 42;

  const rodape = () => {
    doc.setTextColor(...CINZA);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${pagina}`, w - m, h - 8, { align: "right" });
  };

  jogos.forEach((g, i) => {
    if (y > h - 18) {
      rodape();
      doc.addPage();
      pagina++;
      y = 16;
    }
    if (i % 2 === 0) {
      doc.setFillColor(...VERDE_CLARO);
      doc.rect(m, y - 5, w - m * 2, 8, "F");
    }
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(g.oficial ? OURO : VERDE));
    doc.text(`#${i + 1}`, m + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 50, 40);
    const nome = String(g.participantName || "—");
    doc.text(nome.length > 34 ? `${nome.slice(0, 33)}…` : nome, m + 14, y);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.text(parseDezenas(g.dezenas).join("  "), w - m - 2, y, { align: "right" });
    y += 8;
  });

  rodape();
  doc.save("Todos_os_Jogos_Bolao_Mega_da_Virada.pdf");
}
