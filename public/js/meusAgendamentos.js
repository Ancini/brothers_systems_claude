import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const PAGINA_TAMANHO = 5;

// Estado da paginação "5 em 5": página 0 = os mais recentes. Páginas já
// buscadas ficam em cache (evita reconsultar ao ir e voltar); "última página"
// é conhecida assim que uma busca volta com menos de PAGINA_TAMANHO linhas.
let paginaAgendamentosAtual = 0;
let cachePaginasAgendamentos = new Map();
let ultimaPaginaAgendamentos = null;

function formatarHorario24h(horario24) {
    if (!horario24) return "--:--";
    const [horaStr, minutoStr] = horario24.split(":");
    return `${horaStr.padStart(2, "0")}:${minutoStr}`;
}

function formatarData(dataTexto) {
    if (!dataTexto) return { data: "-", diaSemana: "" };
    const [ano, mes, dia] = dataTexto.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    return {
        data: `${dia} de ${MESES[mes - 1]} de ${ano}`,
        diaSemana: DIAS_SEMANA[data.getDay()]
    };
}

function exibirNomeCliente(usuario) {
    const elNome = document.querySelector(".cliente-info .nome");
    if (!elNome) return;
    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";
    elNome.textContent = nomeCompleto.split(" ")[0];
}

// Escapa texto vindo do banco antes de inserir via innerHTML — evita XSS armazenado.
function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function criarCardAgendamento(ag) {
    const hora = formatarHorario24h(ag.horario_inicio);
    const { data, diaSemana } = formatarData(ag.data_agendamento);

    const card = document.createElement("div");
    card.className = "agendamento-card";
    card.innerHTML = `
        <div class="agendamento-info">
            <span class="barbeiro-label">Barbeiro</span>
            <span class="barbearia-nome">${escapeHtml(ag.nome_barbeiro || "-")}</span>
            <span class="servico-label">Serviço: ${escapeHtml(ag.nome_servico || "-")}</span>
            <span class="data-label">Data</span>
            <span class="data-valor">${data}</span>
        </div>
        <div class="agendamento-horario">
            <span class="horario">${hora}</span>
            <span class="dia-semana">${diaSemana}</span>
        </div>
    `;
    return card;
}

// Desenha a lista de uma página (empilhados, mais recente no topo — mesma
// ordem/layout de sempre). agendamentos já vem filtrado e na ordem certa.
function renderizarAgendamentos(agendamentos) {
    const container = document.querySelector(".agendamentos-lista");
    if (!container) return;

    container.innerHTML = "";

    if (agendamentos.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Você ainda não tem agendamentos.</p>`;
        return;
    }

    agendamentos.forEach(ag => container.appendChild(criarCardAgendamento(ag)));
}

// Busca (ou reaproveita do cache) a página pedida e desenha. total sempre
// mostra quantos estão carregados até agora (cresce conforme "anterior" é usado).
async function carregarPaginaAgendamentos(usuario, pagina) {
    if (cachePaginasAgendamentos.has(pagina)) {
        renderizarAgendamentos(cachePaginasAgendamentos.get(pagina));
        atualizarSetasAgendamentos();
        return;
    }

    const { data, error } = await supabase
        .from("vw_meus_agendamentos")
        .select("*")
        .eq("id_usuario", usuario.id_usuario)
        // vw_meus_agendamentos traz o histórico completo, cancelado incluso —
        // aqui só interessa o que ainda está ativo (status is.null cobre
        // agendamentos antigos sem status explícito, tratados como confirmados).
        .or("status.is.null,status.not.ilike.%cancel%")
        .order("data_agendamento", { ascending: false })
        .order("horario_inicio", { ascending: false })
        .range(pagina * PAGINA_TAMANHO, pagina * PAGINA_TAMANHO + PAGINA_TAMANHO - 1);

    if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        const container = document.querySelector(".agendamentos-lista");
        if (container) {
            container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Erro ao carregar agendamentos.</p>`;
        }
        return;
    }

    const pagina_ = data || [];
    cachePaginasAgendamentos.set(pagina, pagina_);
    if (pagina_.length < PAGINA_TAMANHO) ultimaPaginaAgendamentos = pagina;

    const elTotal = document.querySelector(".agendamentos-total");
    if (elTotal) elTotal.textContent = pagina_.length;

    renderizarAgendamentos(pagina_);
    atualizarSetasAgendamentos();
}

function atualizarSetasAgendamentos() {
    const btnAnterior = document.getElementById("btn-agendamentos-anterior");
    const btnProximo = document.getElementById("btn-agendamentos-proximo");
    const elInfo = document.getElementById("agendamentos-pagina-info");
    if (!btnAnterior || !btnProximo) return;

    btnAnterior.disabled = ultimaPaginaAgendamentos !== null && paginaAgendamentosAtual >= ultimaPaginaAgendamentos;
    btnProximo.disabled = paginaAgendamentosAtual <= 0;

    if (elInfo) {
        const paginaVazia = paginaAgendamentosAtual === 0 && cachePaginasAgendamentos.get(0)?.length === 0;
        elInfo.textContent = paginaVazia ? "" : `Página ${paginaAgendamentosAtual + 1}`;
    }
}

function mudarPaginaAgendamentos(direcao, usuario) {
    const novaPagina = paginaAgendamentosAtual + direcao;
    if (novaPagina < 0) return;
    if (ultimaPaginaAgendamentos !== null && novaPagina > ultimaPaginaAgendamentos) return;

    paginaAgendamentosAtual = novaPagina;
    carregarPaginaAgendamentos(usuario, paginaAgendamentosAtual);
}

function configurarSetasAgendamentos(usuario) {
    const btnAnterior = document.getElementById("btn-agendamentos-anterior");
    const btnProximo = document.getElementById("btn-agendamentos-proximo");
    if (!btnAnterior || !btnProximo) return;

    // "Anterior" (‹) avança pra página seguinte = mais antigos; "Próximo" (›)
    // volta pra página anterior = mais recentes (página 0 é sempre a mais nova).
    btnAnterior.addEventListener("click", () => mudarPaginaAgendamentos(1, usuario));
    btnProximo.addEventListener("click", () => mudarPaginaAgendamentos(-1, usuario));
}

async function carregarPontuacao(usuario) {
    const { data, error } = await supabase
        .from("vw_pontuacao_usuario")
        .select("pontuacao_total")
        .eq("id_usuario", usuario.id_usuario)
        .single();

    if (error) {
        console.error("Erro ao carregar a pontuação:", error);
        return;
    }

    const elPontuacao = document.getElementById("pontuacao-usuario");
    if (elPontuacao) elPontuacao.textContent = data?.pontuacao_total ?? 0;
}

function configurarBotaoRetornar() {
    const btn = document.querySelector(".btn-retornar");
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = "menu_cliente.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const usuario = pegarSessao();

    if (!usuario) {
        alert("Você não está logado! Redirecionando para o login...");
        window.location.href = "index.html";
        return;
    }

    exibirNomeCliente(usuario);
    configurarBotaoRetornar();

    if (!usuario.id_usuario) {
        console.warn("Nenhum id_usuario encontrado na sessão.");
        return;
    }

    configurarSetasAgendamentos(usuario);
    carregarPaginaAgendamentos(usuario, 0);
    carregarPontuacao(usuario);
});
