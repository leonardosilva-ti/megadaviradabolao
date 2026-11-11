// Aplica o tema salvo (claro/escuro) antes de desenhar a página, para não "piscar" o tema errado.
// Carregado como script comum (sem defer/module) no <head>; o restante fica em js/tema.js.
try {
  var temaSalvo = JSON.parse(localStorage.getItem("megadavirada_tema"));
  if (temaSalvo === "dark" || temaSalvo === "light") document.documentElement.dataset.theme = temaSalvo;
} catch (e) { /* armazenamento indisponível: segue o tema do aparelho */ }
