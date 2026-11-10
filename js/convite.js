import { EDICAO } from "./config.js";
import { $$, toast } from "./ui.js";
import { copyToClipboard, formatBRL } from "./utils.js";

/** Link público do site (o mesmo endereço em que o participante está). */
export const linkDoSite = () => new URL("./", location.href).href;

function textoConvite(valorCota) {
  return [
    `🍀 Bolão da Mega da Virada ${EDICAO.dataSorteio.slice(-4)}! O prêmio já está em ${EDICAO.premioEstimado}! 💰`,
    "",
    `Estou participando do bolão da família e amigos e quero você junto. Com a cota de ${formatBRL(valorCota)} você escolhe seus 5 jogos e ainda participa dos jogos especiais de 7, 8 e 9 dezenas que o grupo faz com o fundo do bolão. Quanto mais gente, mais jogos especiais para todos!`,
    "",
    `⏰ Cadastre-se e pague até ${EDICAO.prazoPagamento}. Sorteio em ${EDICAO.dataSorteio}.`,
  ].join("\n");
}

/** Mensagem completa com o link, pronta para colar. */
export const mensagemConvite = (valorCota) => `${textoConvite(valorCota)}\n\n👉 ${linkDoSite()}`;

/** Preenche as prévias do convite na página ([data-convite-preview]). */
export function renderConvite(valorCota) {
  $$("[data-convite-preview]").forEach((el) => { el.textContent = mensagemConvite(valorCota); });
}

export function compartilharWhatsApp(valorCota) {
  window.open(`https://wa.me/?text=${encodeURIComponent(mensagemConvite(valorCota))}`, "_blank", "noopener");
}

/** Compartilhamento nativo do celular (Instagram, Telegram, SMS…); sem suporte, copia o convite. */
export async function compartilharApp(valorCota) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "Bolão da Mega da Virada", text: textoConvite(valorCota), url: linkDoSite() });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // a pessoa fechou a janela de compartilhar
    }
  }
  await copiarConvite(valorCota);
}

export async function copiarConvite(valorCota) {
  const ok = await copyToClipboard(mensagemConvite(valorCota));
  toast(ok ? "Convite copiado! É só colar em qualquer conversa." : "Não foi possível copiar o convite.", ok ? "success" : "error");
}
