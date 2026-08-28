import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const TOP_N = 8;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

let modoPeriodo = "mensal"; // "mensal" | "anual"
let mesSelecionado = formatarAnoMes(new Date()); // "YYYY-MM"
let estabelecimentoSelecionado = null; // null = geral (todas as lojas)

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
        // vw_meus_agendamentos traz o histórico completo (cancelados inclusos,
        // de propósito — é o mesmo histórico exibido em meusAgendamentos.html),
        // então filtra cancelado aqui em vez de usar count:true na consulta.
        supabase
            .from("vw_meus_agendamentos")
            .select("id_agendamento, status")
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
        const agendamentosAtivos = (agendamentosResp.data || []).filter(
            ag => !(ag.status || "").toLowerCase().includes("cancel")
        );
        const elAgendamentos = document.getElementById("stat-agendamentos");
        if (elAgendamentos) elAgendamentos.textContent = agendamentosAtivos.length;
    }

    if (pontuacaoResp.error) {
        console.error("Erro ao buscar pontuação:", pontuacaoResp.error);
    } else {
        const elPontuacao = document.getElementById("stat-pontuacao");
        if (elPontuacao) elPontuacao.textContent = pontuacaoResp.data?.pontuacao_total ?? 0;
    }
}

// Soma os pontos de cada agendamento (pontuacao_servico) dentro do intervalo
// selecionado, agrupando por cliente — geral (idEstabelecimento null/undefined)
// ou de uma barbearia específica. Depende de vw_pontuacao_periodo já expor
// id_estabelicimento e já excluir agendamento cancelado (recriada 2026-08-28
// especificamente pra isso). Retorna null em erro de consulta (distinto de
// "sem dados"), pra tela mostrar mensagem certa.
async function buscarRanking(inicio, fim, idEstabelecimento) {
    let consulta = supabase
        .from("vw_pontuacao_periodo")
        .select("id_usuario, usuario, data_agendamento, pontuacao_servico")
        .gte("data_agendamento", inicio)
        .lt("data_agendamento", fim);

    if (idEstabelecimento) {
        consulta = consulta.eq("id_estabelicimento", idEstabelecimento);
    }

    const { data, error } = await consulta;

    if (error || !data) {
        console.error("Erro ao carregar ranking:", error);
        return null;
    }

    const totais = new Map();
    data.forEach(linha => {
        const atual = totais.get(linha.id_usuario) || { usuario: linha.usuario, total: 0 };
        atual.total += Number(linha.pontuacao_servico || 0);
        totais.set(linha.id_usuario, atual);
    });

    return Array.from(totais.entries()).map(([id_usuario, valores]) => ({
        id_usuario, usuario: valores.usuario, total: valores.total
    }));
}

async function carregarRanking(usuario) {
    const container = document.querySelector(".lista-ranking");
    if (!container) return;

    container.innerHTML = `<p class="ranking-carregando">Carregando ranking...</p>`;

    const { inicio, fim, texto } = intervaloDoPeriodo();
    const elSub = document.querySelector(".ranking-sub");

    if (estabelecimentoSelecionado) {
        const selectEstab = document.getElementById("estabelecimento-select");
        const nomeEstab = selectEstab?.selectedOptions[0]?.textContent || "";
        if (elSub) elSub.textContent = `${nomeEstab} — ${texto}`;
    } else {
        if (elSub) elSub.textContent = texto;
    }

    const ranking = await buscarRanking(inicio, fim, estabelecimentoSelecionado);

    if (ranking === null) {
        container.innerHTML = `<p class="ranking-carregando">Erro ao carregar o ranking.</p>`;
        return;
    }

    ranking.sort((a, b) => b.total - a.total);

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

// Popula o <select> com todas as barbearias cadastradas — "Geral" (value="")
// já vem fixo no HTML como primeira opção.
async function carregarEstabelecimentos() {
    const select = document.getElementById("estabelecimento-select");
    if (!select) return;

    const { data, error } = await supabase
        .from("estabelicimento")
        .select("id_estabelicimento, nome_estabelicimento")
        .order("nome_estabelicimento");

    if (error) {
        console.error("Erro ao buscar estabelecimentos:", error);
        return;
    }

    (data || []).forEach(estabelecimento => {
        const option = document.createElement("option");
        option.value = estabelecimento.id_estabelicimento;
        option.textContent = estabelecimento.nome_estabelicimento;
        select.appendChild(option);
    });
}

function configurarSeletorEstabelecimento(usuario) {
    const select = document.getElementById("estabelecimento-select");
    if (!select) return;

    select.addEventListener("change", () => {
        estabelecimentoSelecionado = select.value ? Number(select.value) : null;
        carregarRanking(usuario);
    });
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

document.addEventListener("DOMContentLoaded", async () => {
    const usuario = pegarSessao();

    if (usuario) {
        carregarCabecalhoCliente(usuario);
    }
    configurarFiltrosPeriodo(usuario);
    configurarSeletorEstabelecimento(usuario);
    await carregarEstabelecimentos();
    definirModoPeriodo("mensal", usuario);
});
