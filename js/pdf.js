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

function novoDocumento() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error("A biblioteca de PDF ainda não carregou. Verifique a conexão e tente novamente.");
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
export function gerarComprovante(user, games) {
  const doc = novoDocumento();
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
  doc.text(`Os jogos serão registrados na loteria em ${EDICAO.dataRegistro}. Bolão sem vínculo com a Caixa Econômica Federal. Boa sorte!`, w / 2, y + 5, { align: "center" });

  doc.save(`Comprovante_${nomeArquivo(user.name)}.pdf`);
}

/**
 * Lista com todos os jogos (admin).
 * @param {{ participantName: string, dezenas: string, oficial?: boolean, paymentStatus?: string }[]} jogos
 */
export function gerarListaCompleta(jogos) {
  const doc = novoDocumento();
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
