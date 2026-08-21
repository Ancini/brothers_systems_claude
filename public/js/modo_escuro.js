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
        html.modo-escuro,
        html.modo-escuro body {
            background-color: #000;
            color: #fff;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Algumas páginas têm um .container com fundo branco próprio, que
           ficava escondendo o preto do body atrás dele */
        html.modo-escuro .container,
        html.modo-escuro .container-login,
        html.modo-escuro .grid-topo {
            background-color: #000 !important;
        }

        /* Cards e blocos "de card" viram pretos com borda e texto brancos.
           As imagens dentro deles (logos, ícones, fotos) NÃO são tocadas,
           continuam com a cor original. */
        html.modo-escuro .card,
        html.modo-escuro .cliente-card,
        html.modo-escuro .pontuacao-card,
        html.modo-escuro .calendario-card,
        html.modo-escuro .ranking-card,
        html.modo-escuro .busca-card,
        html.modo-escuro .barbeiro-acesso-card,
        html.modo-escuro .estabelecimento-item,
        html.modo-escuro .estabelecimentos-grid,
        html.modo-escuro .ranking-section,
        html.modo-escuro .pontuacao-section,
        html.modo-escuro .card-agendamentos-header,
        html.modo-escuro .agendamento-card,
        html.modo-escuro .section-badge-row {
            background: #000 !important;
            background-color: #000 !important;
            background-image: none !important;
            border: 1px solid #fff !important;
            color: #fff !important;
        }

        /* Containers de página (login/cadastro/recuperar senha) só trocam
           fundo e texto — sem borda externa, a borda fica só nos campos
           e botões de dentro */
        html.modo-escuro .login-box,
        html.modo-escuro .form-wrapper {
            background: #000 !important;
            background-color: #000 !important;
            background-image: none !important;
            color: #fff !important;
        }

        html.modo-escuro .card *,
        html.modo-escuro .cliente-card *,
        html.modo-escuro .pontuacao-card *,
        html.modo-escuro .calendario-card *,
        html.modo-escuro .ranking-card *,
        html.modo-escuro .busca-card *,
        html.modo-escuro .barbeiro-acesso-card *,
        html.modo-escuro .estabelecimento-item *,
        html.modo-escuro .ranking-section *,
        html.modo-escuro .pontuacao-section *,
        html.modo-escuro .card-agendamentos-header *,
        html.modo-escuro .agendamento-card *,
        html.modo-escuro .section-badge-row *,
        html.modo-escuro .login-box *,
        html.modo-escuro .form-wrapper * {
            color: #fff !important;
        }

        /* Mantém as imagens com a cor original, mesmo dentro de um card preto */
        html.modo-escuro img {
            filter: none !important;
        }

        /* Campos e botões das telas de login, cadastro e recuperar senha */
        html.modo-escuro input {
            background-color: #000 !important;
            color: #fff !important;
            border: 1px solid #fff !important;
        }

        html.modo-escuro input::placeholder {
            color: #fff !important;
        }

        html.modo-escuro .botao_entrar button,
        html.modo-escuro .botao_cadastrar button,
        html.modo-escuro .botao_enviar button,
        html.modo-escuro .botao_link {
            background-color: #000 !important;
            color: #fff !important;
            border: 1px solid #fff !important;
        }

        /* Esse link específico já ganha aparência de botão no CSS base;
           no escuro só troca a cor, sem borda extra */
        html.modo-escuro .btn-link {
            background-color: #000 !important;
            color: #fff !important;
        }

        html.modo-escuro .brand-footer-nome {
            color: #fff !important;
        }

        /* Rodapé (tag <footer>) que tinha fundo azul/cinza fixo */
        html.modo-escuro footer {
            background-color: #000 !important;
            border: none !important;
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

        html.modo-escuro #botao-modo-escuro {
            border: 1px solid #fff;
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
