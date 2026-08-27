import { pegarSessao } from "./session.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Dados de exemplo até o back-end (busca por funcionário/comissão) ser implementado.
const FUNCIONARIOS_DEMO = [
    { nome: "Gabriel Ancini", vendas: 3500, comissao: 1600 },
    { nome: "Alexandre Necher", vendas: 1500, comissao: 1500 },
    { nome: "Lucas Gabriel", vendas: 1000, comissao: 600 }
];

const TOTAL_ARRECADADO_DEMO = 3500;

function formatarMoeda(valor) {
    return `R$${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Reais`;
}

function formatarMoedaCurta(valor) {
    return `R$${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function preencherNomeDono() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("dono-nome");
    if (!elNome) return;

    const nomeCompleto = usuario?.nome || usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Proprietário";
    elNome.textContent = nomeCompleto;
}

function renderFuncionarios(lista) {
    const container = document.getElementById("funcionarios-lista");
    if (!container) return;

    container.innerHTML = "";
    lista.forEach(funcionario => {
        const card = document.createElement("div");
        card.className = "funcionario-card";
        card.innerHTML = `
            <img src="css/imagens/desenho_barbeiro.png" alt="" class="funcionario-foto">
            <div class="funcionario-info">
                <div class="funcionario-nome"></div>
                <div class="funcionario-vendas">Total em vendas: ${formatarMoedaCurta(funcionario.vendas)}</div>
            </div>
            <div class="funcionario-comissao">
                <div class="funcionario-comissao-label">Parte do funcionário</div>
                <div class="funcionario-comissao-valor">${formatarMoedaCurta(funcionario.comissao)}</div>
            </div>
        `;
        card.querySelector(".funcionario-nome").textContent = funcionario.nome;
        container.appendChild(card);
    });
}

function calcularIntervaloPeriodo(tipo) {
    const hoje = new Date();

    if (tipo === "semana") {
        const inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - hoje.getDay());
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + 7);
        const dataInicioTexto = `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}`;
        const dataFimTexto = `${String(fim.getDate() - 1).padStart(2, "0")}/${String(fim.getMonth() + 1).padStart(2, "0")}`;
        return { inicio, fim, texto: `Semana de ${dataInicioTexto} até ${dataFimTexto}` };
    }

    if (tipo === "ano") {
        const inicio = new Date(hoje.getFullYear(), 0, 1);
        const fim = new Date(hoje.getFullYear() + 1, 0, 1);
        return { inicio, fim, texto: `Em ${hoje.getFullYear()}` };
    }

    // "mes" (padrão)
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return { inicio, fim, texto: `Em ${capitalizar(MESES[hoje.getMonth()])} de ${hoje.getFullYear()}` };
}

function aplicarPeriodoNaTela(texto) {
    const elPeriodo = document.getElementById("periodo-info");
    if (elPeriodo) elPeriodo.textContent = texto;

    // Dados ainda são de exemplo — a busca real por período entra junto com o back-end.
    const elValor = document.getElementById("valor-total");
    if (elValor) elValor.textContent = formatarMoeda(TOTAL_ARRECADADO_DEMO);
    renderFuncionarios(FUNCIONARIOS_DEMO);
}

function filtrarPeriodo(tipo) {
    document.querySelectorAll(".filtro-btn").forEach(btn => {
        btn.classList.toggle("ativo", btn.dataset.periodo === tipo);
    });

    const painel = document.getElementById("painel-intervalo");
    if (painel) painel.classList.remove("aberto");

    const { texto } = calcularIntervaloPeriodo(tipo);
    aplicarPeriodoNaTela(texto);
}

function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function aplicarIntervaloPersonalizado() {
    const inicio = document.getElementById("data-inicio")?.value;
    const fim = document.getElementById("data-fim")?.value;
    if (!inicio || !fim) return;

    document.querySelectorAll(".filtro-btn").forEach(btn => btn.classList.remove("ativo"));
    aplicarPeriodoNaTela(`De ${formatarDataBR(inicio)} até ${formatarDataBR(fim)}`);
}

function configurarBotoes() {
    document.querySelectorAll(".filtro-btn").forEach(btn => {
        btn.addEventListener("click", () => filtrarPeriodo(btn.dataset.periodo));
    });

    const btnIntervalo = document.getElementById("btn-intervalo");
    const painelIntervalo = document.getElementById("painel-intervalo");
    if (btnIntervalo && painelIntervalo) {
        btnIntervalo.addEventListener("click", () => {
            painelIntervalo.classList.toggle("aberto");
        });
    }

    const btnAplicarIntervalo = document.getElementById("btn-aplicar-intervalo");
    if (btnAplicarIntervalo) {
        btnAplicarIntervalo.addEventListener("click", aplicarIntervaloPersonalizado);
    }

    const btnVoltar = document.getElementById("btn-voltar");
    if (btnVoltar) {
        btnVoltar.addEventListener("click", () => {
            window.location.href = "menu_inicial_barbeiro.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeDono();
    configurarBotoes();
    filtrarPeriodo("mes");
});
