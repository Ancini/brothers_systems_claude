const CHAVE_TEMA = "modoEscuro";

function temaSalvoAtivo() {
    return localStorage.getItem(CHAVE_TEMA) === "true";
}

function aplicarTema(ativo) {
    document.documentElement.classList.toggle("modo-escuro", ativo);
    const botao = document.getElementById("botao-modo-escuro");
    if (botao) botao.textContent = ativo ? "☀️" : "🌙";
}

function injetarEstilos() {
    if (document.getElementById("estilo-modo-escuro")) return;

    const style = document.createElement("style");
    style.id = "estilo-modo-escuro";
    style.textContent = `
        html {
            transition: filter 0.3s ease;
        }

        html.modo-escuro {
            filter: grayscale(1) invert(1);
        }

        /* Cancela o invert só nas imagens, pra não virarem "negativo de filme" */
        html.modo-escuro img,
        html.modo-escuro video {
            filter: invert(1);
        }

        #botao-modo-escuro {
            position: fixed;
            bottom: 18px;
            right: 18px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background-color: #222;
            color: #fff;
            font-size: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
            z-index: 9999;
            transition: transform 0.2s ease;
        }

        #botao-modo-escuro:hover {
            transform: scale(1.08);
        }
    `;
    document.head.appendChild(style);
}

function criarBotao() {
    if (document.getElementById("botao-modo-escuro")) return;

    const botao = document.createElement("button");
    botao.id = "botao-modo-escuro";
    botao.type = "button";
    botao.setAttribute("aria-label", "Alternar modo escuro");

    botao.addEventListener("click", () => {
        const novoEstado = !document.documentElement.classList.contains("modo-escuro");
        localStorage.setItem(CHAVE_TEMA, String(novoEstado));
        aplicarTema(novoEstado);
    });

    document.body.appendChild(botao);
}

document.addEventListener("DOMContentLoaded", () => {
    injetarEstilos();
    criarBotao();
    aplicarTema(temaSalvoAtivo());
});
