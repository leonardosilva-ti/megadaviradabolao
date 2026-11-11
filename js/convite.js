import { EDICAO } from "./config.js";
import { $$, toast } from "./ui.js";
import { copyToClipboard, formatBRL } from "./utils.js";

/** Link público do site (o mesmo endereço em que o participante está). */
export const linkDoSite = () => new URL("./", location.href).href;

function textoConvite(valorCota) {
  return [
    "E aí, pessoal, beleza? 🍀",
    "",
    "Como todos sabem, todo final de ano eu organizo o bolão da Mega da Virada. Vai que a gente dá um azar e acaba ganhando! 😄 Da última vez tivemos mais de 160 jogos no nosso bolão, fora o jogo de 9 números.",
    "",
    `Quem quiser participar é só se cadastrar no link abaixo, escolher seus números da sorte e torcer. A cota é de ${formatBRL(valorCota)}. Já dá para se cadastrar agora, e o pagamento pode ser feito até ${EDICAO.prazoPagamento}.`,
    "",
    "No site você também acompanha todos os jogos do bolão e, depois do sorteio, consegue fazer a sua própria conferência.",
    "",
    `Boa sorte para nós nesse bilhão que está em jogo! 💰 Sorteio em ${EDICAO.dataSorteio}.`,
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
