import { $, openDialog, toast } from "./ui.js";
import { html, render } from "./utils.js";

let installPrompt = null;

export function setupPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    toast("Aplicativo instalado na sua tela inicial!", "success");
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("[sw]", err));
    });
  }
}

export async function instalarApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    if (outcome === "accepted") toast("Instalação iniciada!", "success");
    return;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  render($("#install-instructions"), standalone
    ? html`<p>O app já está instalado neste aparelho. 🎉</p>`
    : isIOS
      ? html`<p>No <strong>iPhone / iPad</strong> (Safari):</p>
          <ol><li>Toque em <strong>Compartilhar</strong> (quadrado com seta para cima).</li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Toque em <strong>Adicionar</strong>.</li></ol>`
      : html`<p>No <strong>Android</strong> (Chrome):</p>
          <ol><li>Toque no menu <strong>⋮</strong> no canto superior.</li>
          <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
          <li>Confirme em <strong>Instalar</strong>.</li></ol>`);
  openDialog("dialog-install");
}
