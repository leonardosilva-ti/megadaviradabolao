/**
 * pdfGenerator.js
 * Geração de PDFs client-side usando jsPDF para o Bolão da Mega da Virada.
 */

const PdfGenerator = {

  /**
   * Gera o comprovante PDF dos jogos de um participante.
   * @param {string} participantName - Nome do participante
   * @param {string} participantPhone - Telefone do participante
   * @param {Array}  games - Array de objetos { gameNumber, dezenas }
   * @returns {boolean} true se gerado com sucesso
   */
  generateReceiptPdf: function(participantName, participantPhone, games) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Cabeçalho
      doc.setFillColor(6, 28, 18);
      doc.rect(0, 0, pageW, 45, "F");

      doc.setTextColor(255, 215, 0);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("🎰 Bolão da Mega da Virada", pageW / 2, y, { align: "center" });

      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(200, 200, 200);
      doc.setFont("helvetica", "normal");
      doc.text("Comprovante de Participação", pageW / 2, y, { align: "center" });

      y += 8;
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageW / 2, y, { align: "center" });

      y = 58;

      // Dados do participante
      doc.setFillColor(15, 50, 30);
      doc.roundedRect(margin, y, pageW - margin * 2, 22, 3, 3, "F");

      doc.setTextColor(255, 215, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Participante:", margin + 5, y + 8);

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(participantName, margin + 5, y + 16);

      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text(`Tel: ${participantPhone}`, pageW - margin - 5, y + 16, { align: "right" });

      y += 30;

      // Jogos
      doc.setTextColor(255, 215, 0);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Seus 5 Palpites Cadastrados:", margin, y);
      y += 7;

      doc.setDrawColor(255, 215, 0);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      const colors = [
        [52, 211, 153],   // verde
        [96, 165, 250],   // azul
        [251, 191, 36],   // amarelo
        [248, 113, 113],  // vermelho
        [167, 139, 250],  // roxo
      ];

      (games || []).forEach((g, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        const color = colors[idx % colors.length];
        const label = `Jogo ${g.gameNumber || (idx + 1)}`;
        const dezenas = Array.isArray(g.dezenas) ? g.dezenas : (g.dezenas || "").split(",").map(s => s.trim());

        // Fundo do card do jogo
        doc.setFillColor(15, 40, 25);
        doc.roundedRect(margin, y, pageW - margin * 2, 20, 3, 3, "F");

        // Label
        doc.setTextColor(...color);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + 5, y + 7);

        // Bolinhas
        const ballRadius = 5;
        let bx = margin + 35;
        const by = y + 10;

        dezenas.forEach(num => {
          doc.setFillColor(...color);
          doc.circle(bx, by, ballRadius, "F");
          doc.setTextColor(10, 10, 10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          const txt = String(num).padStart(2, "0");
          doc.text(txt, bx, by + 2.5, { align: "center" });
          bx += 13;
        });

        y += 24;
      });

      y += 4;
      // Rodapé de validade
      doc.setFillColor(6, 28, 18);
      doc.rect(margin, y, pageW - margin * 2, 18, "F");

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const footer = "Este comprovante confirma o registro dos seus palpites no Bolão da Mega da Virada.";
      doc.text(footer, pageW / 2, y + 7, { align: "center" });
      doc.text("Os jogos serão cadastrados na loteria federal em 29/12. Boa sorte!", pageW / 2, y + 13, { align: "center" });

      const filename = `Comprovante_${(participantName || "participante").replace(/\s+/g, "_")}.pdf`;
      doc.save(filename);
      return true;
    } catch (e) {
      console.error("Erro ao gerar PDF do comprovante:", e);
      alert("Erro ao gerar PDF. Verifique se o jsPDF foi carregado corretamente.\n\n" + e.message);
      return false;
    }
  },

  /**
   * Gera o PDF com todos os jogos do bolão (admin).
   * @param {Array} allGames - Array de objetos { participantName, gameNumber, dezenas }
   * @param {string} title - Título do documento
   * @returns {boolean}
   */
  generateAllGamesPdf: function(allGames, title) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      let y = 20;
      let pageNum = 1;

      const addHeader = (isFirst) => {
        doc.setFillColor(6, 28, 18);
        doc.rect(0, 0, pageW, isFirst ? 40 : 20, "F");

        doc.setTextColor(255, 215, 0);
        doc.setFontSize(isFirst ? 16 : 11);
        doc.setFont("helvetica", "bold");
        doc.text(title || "Todos os Jogos do Bolão - Mega da Virada", pageW / 2, isFirst ? 16 : 12, { align: "center" });

        if (isFirst) {
          doc.setFontSize(9);
          doc.setTextColor(200, 200, 200);
          doc.setFont("helvetica", "normal");
          doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total: ${allGames.length} jogos`, pageW / 2, 25, { align: "center" });
          doc.text(`Página ${pageNum}`, pageW - margin, 33, { align: "right" });
          return 48;
        } else {
          doc.setFontSize(8);
          doc.setTextColor(180, 180, 180);
          doc.text(`Página ${pageNum}`, pageW - margin, 17, { align: "right" });
          return 28;
        }
      };

      y = addHeader(true);

      // Tabela de jogos
      allGames.slice(0, 1000).forEach((g, idx) => {
        if (y > pageH - 20) {
          doc.addPage();
          pageNum++;
          y = addHeader(false);
        }

        const bg = idx % 2 === 0 ? [15, 40, 25] : [10, 30, 18];
        doc.setFillColor(...bg);
        doc.rect(margin, y, pageW - margin * 2, 10, "F");

        // Número sequencial
        doc.setTextColor(255, 215, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`#${idx + 1}`, margin + 3, y + 6.5);

        // Nome do participante
        doc.setTextColor(200, 200, 200);
        doc.setFont("helvetica", "normal");
        const name = g.participantName || g.name || "—";
        doc.text(name.substring(0, 20), margin + 15, y + 6.5);

        // Dezenas
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        const dezenas = Array.isArray(g.dezenas)
          ? g.dezenas.map(n => String(n).padStart(2, "0")).join("  ")
          : (g.dezenas || "").split(",").map(s => String(s.trim()).padStart(2, "0")).join("  ");
        doc.text(dezenas, pageW - margin - 3, y + 6.5, { align: "right" });

        y += 11;
      });

      // Rodapé final
      if (y < pageH - 18) {
        doc.setDrawColor(255, 215, 0);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 4, pageW - margin, y + 4);

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(`Total de ${allGames.length} jogos registrados | Bolão Mega da Virada`, pageW / 2, y + 10, { align: "center" });
      }

      doc.save("Todos_os_Jogos_Bolao_Mega.pdf");
      return true;
    } catch (e) {
      console.error("Erro ao gerar PDF com todos os jogos:", e);
      alert("Erro ao gerar PDF.\n\n" + e.message);
      return false;
    }
  },

  /**
   * Gera e baixa o arquivo TXT com todos os jogos (formato para loteria).
   * Formato: 02,07,15,23,28,50  (uma linha por jogo)
   * @param {Array} allGames - Array de objetos com { dezenas }
   */
  downloadTxt: function(allGames) {
    try {
      const lines = (allGames || []).map(g => {
        const nums = Array.isArray(g.dezenas)
          ? g.dezenas.map(n => String(n).padStart(2, "0"))
          : (g.dezenas || "").split(",").map(s => String(s.trim()).padStart(2, "0"));
        return nums.join(",");
      });

      const content = lines.join("\n");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jogos_loteria.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error("Erro ao gerar TXT:", e);
      alert("Erro ao gerar arquivo TXT.\n\n" + e.message);
      return false;
    }
  }
};
