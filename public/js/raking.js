import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const TOP_N = 8;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

let modoPeriodo = "mensal"; // "mensal" | "anual"
let mesSelecionado = formatarAnoMes(new Date()); // "YYYY-MM"

function formatarAnoMes(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    return `${ano}-${mes}`;
}

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function intervaloDoPeriodo() {
    if (modoPeriodo === "anual") {
        const ano = new Date().getFullYear();
        return {
            inicio: `${ano}-01-01`,
            fim: `${ano + 1}-01-01`,
            texto: `Tabela de pontuação — ${ano}`
        };
    }

    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);
    return {
        inicio: formatarDataBanco(inicio),
        fim: formatarDataBanco(fim),
        texto: `Tabela de pontuação — ${MESES[mes - 1]}/${ano}`
    };
}

// Escapa texto vindo do banco (ex: nome escolhido pelo próprio usuário no
// cadastro) antes de inserir via innerHTML — evita XSS armazenado, já que
// esse ranking é visto por todos os clientes.
function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function criarItemRanking(posicao, nome, pontos) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<span>${posicao}º ${escapeHtml(nome)}</span><span>${String(pontos).padStart(2, "0")} pt</span>`;
    return item;
}

async function carregarCabecalhoCliente(usuario) {
    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";
    const elNome = document.getElementById("cliente-nome");
    if (elNome) elNome.textContent = nomeCompleto.split(" ")[0];

    if (!usuario.id_usuario) return;

    const [agendamentosResp, pontuacaoResp] = await Promise.all([
        supabase
            .from("vw_meus_agendamentos")
            .select("id_agendamento", { count: "exact", head: true })
            .eq("id_usuario", usuario.id_usuario),
        supabase
            .from("vw_pontuacao_usuario")
            .select("pontuacao_total")
            .eq("id_usuario", usuario.id_usuario)
            .single()
    ]);

    if (agendamentosResp.error) {
        console.error("Erro ao buscar total de agendamentos:", agendamentosResp.error);
    } else {
        const elAgendamentos = document.getElementById("stat-agendamentos");
        if (elAgendamentos) elAgendamentos.textContent = agendamentosResp.count ?? 0;
    }

    if (pontuacaoResp.error) {
        console.error("Erro ao buscar pontuação:", pontuacaoResp.error);
    } else {
        const elPontuacao = document.getElementById("stat-pontuacao");
        if (elPontuacao) elPontuacao.textContent = pontuacaoResp.data?.pontuacao_total ?? 0;
    }
}

// Ranking por período: soma os pontos de cada agendamento (pontuacao_servico) dentro
// do intervalo selecionado, agrupando por cliente. Depende da view vw_pontuacao_periodo
// (id_usuario, usuario, data_agendamento, pontuacao_servico) — precisa existir no Supabase.
async function carregarRanking(usuario) {
    const container = document.querySelector(".lista-ranking");
    if (!container) return;

    container.innerHTML = `<p class="ranking-carregando">Carregando ranking...</p>`;

    const { inicio, fim, texto } = intervaloDoPeriodo();

    const elSub = document.querySelector(".ranking-sub");
    if (elSub) elSub.textContent = texto;

    const { data, error } = await supabase
        .from("vw_pontuacao_periodo")
        .select("id_usuario, usuario, data_agendamento, pontuacao_servico")
        .gte("data_agendamento", inicio)
        .lt("data_agendamento", fim);

    if (error || !data) {
        console.error("Erro ao carregar ranking:", error);
        container.innerHTML = `<p class="ranking-carregando">Erro ao carregar o ranking.</p>`;
        return;
    }

    const totais = new Map();
    data.forEach(linha => {
        const atual = totais.get(linha.id_usuario) || { usuario: linha.usuario, total: 0 };
        atual.total += Number(linha.pontuacao_servico || 0);
        totais.set(linha.id_usuario, atual);
    });

    const ranking = Array.from(totais.entries())
        .map(([id_usuario, valores]) => ({ id_usuario, usuario: valores.usuario, total: valores.total }))
        .sort((a, b) => b.total - a.total);

    container.innerHTML = "";

    if (ranking.length === 0) {
        container.innerHTML = `<p class="ranking-carregando">Nenhum ponto registrado neste período.</p>`;
    } else {
        ranking.slice(0, TOP_N).forEach((linha, indice) => {
            container.appendChild(criarItemRanking(indice + 1, linha.usuario, linha.total));
        });
    }

    if (!usuario?.id_usuario) return;

    const posicaoCliente = ranking.findIndex(linha => linha.id_usuario === usuario.id_usuario);
    if (posicaoCliente >= TOP_N) {
        const linhaCliente = ranking[posicaoCliente];
        const itemCliente = criarItemRanking(posicaoCliente + 1, linhaCliente.usuario, linhaCliente.total);
        itemCliente.classList.add("item-atual");
        container.appendChild(itemCliente);
    }
}

function definirModoPeriodo(modo, usuario) {
    modoPeriodo = modo;
    document.querySelectorAll(".grupo-vermelho .btn[data-periodo]").forEach(btn => {
        btn.classList.toggle("ativo", btn.dataset.periodo === modo);
    });
    carregarRanking(usuario);
}

function configurarFiltrosPeriodo(usuario) {
    const btnSelecionarMes = document.getElementById("btn-selecionar-mes");
    const inputMes = document.getElementById("input-mes");

    if (inputMes) inputMes.value = mesSelecionado;

    if (btnSelecionarMes && inputMes) {
        btnSelecionarMes.addEventListener("click", () => {
            inputMes.classList.toggle("escondido");
            if (!inputMes.classList.contains("escondido")) {
                inputMes.focus();
                if (typeof inputMes.showPicker === "function") {
                    try { inputMes.showPicker(); } catch (erro) { /* nem todo navegador suporta */ }
                }
            }
        });

        inputMes.addEventListener("change", () => {
            if (!inputMes.value) return;
            mesSelecionado = inputMes.value;
            definirModoPeriodo("mensal", usuario);
        });
    }

    document.querySelectorAll(".grupo-vermelho .btn[data-periodo]").forEach(btn => {
        btn.addEventListener("click", () => definirModoPeriodo(btn.dataset.periodo, usuario));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const usuario = pegarSessao();

    if (usuario) {
        carregarCabecalhoCliente(usuario);
    }
    configurarFiltrosPeriodo(usuario);
    definirModoPeriodo("mensal", usuario);
});
