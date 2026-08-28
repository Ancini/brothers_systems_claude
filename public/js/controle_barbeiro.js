// 1. CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://hnaapsbkrokrkmnzayyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let idBarbeiroLogado = null;
let dataSelecionadaAtual = null;
const LARGURA_BOTAO_CANCELAR = 130;

const AGENDAMENTOS_POR_PAGINA = 5;
let agendamentosDoDia = []; // todos os agendamentos ativos do dia selecionado
let paginaAgendamentosAtual = 0;

document.addEventListener("DOMContentLoaded", async () => {
    configurarSetasAgendamentos();

    const sucesso = await inicializarIdentidadeBarbeiro();
    if (sucesso) {
        inicializarLinhaDoTempo();
        buscarTotalVendasDoMes();
    } else {
        console.error("Não foi possível identificar o barbeiro. Verifique o login ou o vínculo no banco.");
    }
});

// Formata um Date pra "YYYY-MM-DD" usando o fuso local (evita o desvio de dia do toISOString)
function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// "YYYY-MM-DD" do dia seguinte, sem passar por UTC em nenhum momento
function proximoDiaBanco(dataBanco) {
    const [ano, mes, dia] = dataBanco.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    data.setDate(data.getDate() + 1);
    return formatarDataBanco(data);
}

// FUNÇÃO DA PONTE
async function inicializarIdentidadeBarbeiro() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    const { data: vinculo, error } = await supabaseClient
        .from('prestador')
        .select('id_prestador, usuario:prestador_id_prestador_fkey ( nome_usuario )')
        .eq('uuid_vinculo', user.id)
        .limit(1);

    if (error || !vinculo || vinculo.length === 0) return false;

    idBarbeiroLogado = vinculo[0].id_prestador;
    exibirNomeBarbeiro(vinculo[0].usuario?.nome_usuario);
    return true;
}

function exibirNomeBarbeiro(nome) {
    const elNome = document.querySelector(".card.barbeiro .titulo2");
    if (elNome && nome) elNome.textContent = nome;
}

// Arrasta com o mouse pra rolar (no touch já rola de graça) e converte a rodinha
// vertical em scroll lateral, já que o container não tem gesto horizontal nativo no desktop.
function configurarArrastoComMouse(container) {
    let arrastando = false;
    let comecouArrasto = false;
    let inicioX = 0;
    let scrollInicial = 0;

    container.addEventListener("mousedown", (evento) => {
        arrastando = true;
        comecouArrasto = false;
        inicioX = evento.clientX;
        scrollInicial = container.scrollLeft;
        container.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (evento) => {
        if (!arrastando) return;
        const delta = evento.clientX - inicioX;
        if (Math.abs(delta) > 5) comecouArrasto = true;
        container.scrollLeft = scrollInicial - delta;
    });

    window.addEventListener("mouseup", () => {
        arrastando = false;
        container.style.cursor = "grab";
    });

    // Evita que o clique disparado logo após o arrasto ative o card de dia errado.
    container.addEventListener("click", (evento) => {
        if (comecouArrasto) {
            evento.stopPropagation();
            evento.preventDefault();
        }
    }, true);

    container.addEventListener("wheel", (evento) => {
        if (evento.deltaY === 0) return;
        evento.preventDefault();
        container.scrollLeft += evento.deltaY;
    }, { passive: false });
}

// 2. GERA OS 4 DIAS DINAMICAMENTE
function inicializarLinhaDoTempo() {
    const containerDias = document.querySelector(".linha-tempo-dias");
    containerDias.innerHTML = "";
    configurarArrastoComMouse(containerDias);

    for (let i = 0; i < 7; i++) {
        const dataRef = new Date();
        dataRef.setDate(dataRef.getDate() + i);
        const dataFormatadaBanco = formatarDataBanco(dataRef);
        
        const cardDia = document.createElement("div");
        cardDia.className = `card agendamento ${i === 0 ? 'ativo' : ''}`;
        cardDia.innerHTML = `
            <div class="texto-dia">
                <span class="titulo1">${dataRef.getDate()} DE ${["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"][dataRef.getMonth()]}</span>
                <span class="titulo2">${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][dataRef.getDay()]}</span>
            </div>
        `;

        cardDia.addEventListener("click", () => {
            document.querySelectorAll(".linha-tempo-dias .card").forEach(c => c.classList.remove("ativo"));
            cardDia.classList.add("ativo");
            dataSelecionadaAtual = dataFormatadaBanco;
            buscarAgendamentosDaAPI(dataFormatadaBanco);
        });
        containerDias.appendChild(cardDia);
    }
    dataSelecionadaAtual = formatarDataBanco(new Date());
    buscarAgendamentosDaAPI(dataSelecionadaAtual);
}

// 3. BUSCA E RENDERIZAÇÃO
async function buscarAgendamentosDaAPI(dataFiltro) {
    if (!idBarbeiroLogado) return;

    const dataInicio = `${dataFiltro}T00:00:00`;
    const dataFim = `${proximoDiaBanco(dataFiltro)}T00:00:00`;

    try {
        const { data: agendamentos, error } = await supabaseClient
            .from('vw_agenda_do_barbeiro')
            .select('*')
            .eq('id_prestador', idBarbeiroLogado)
            .gte('data_agendamento', dataInicio)
            .lt('data_agendamento', dataFim)
            .order('horario_inicio', { ascending: true });

        if (error) throw error;

        // Mesmo critério usado em selecionar_horario.js: um agendamento cancelado
        // não deve mais aparecer na agenda do barbeiro.
        const agendamentosAtivos = (agendamentos || []).filter(
            ag => !(ag.status || "").toLowerCase().includes("cancel")
        );

        atualizarContadorAgendamentos(agendamentosAtivos.length);
        agendamentosDoDia = agendamentosAtivos;
        paginaAgendamentosAtual = calcularPaginaInicial(dataFiltro, agendamentosDoDia);
        renderizarPaginaAgendamentos();
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
    }
}

// Total de vendas do mês corrente (independente do dia selecionado na linha do tempo)
async function buscarTotalVendasDoMes() {
    if (!idBarbeiroLogado) return;

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

    const dataInicio = `${formatarDataBanco(inicioMes)}T00:00:00`;
    const dataFim = `${formatarDataBanco(inicioProximoMes)}T00:00:00`;

    try {
        const { data: agendamentos, error } = await supabaseClient
            .from('vw_agenda_do_barbeiro')
            .select('valor_servico, status')
            .eq('id_prestador', idBarbeiroLogado)
            .gte('data_agendamento', dataInicio)
            .lt('data_agendamento', dataFim);

        if (error) throw error;

        // Mesmo critério usado em buscarAgendamentosDaAPI: um agendamento
        // cancelado não deve entrar na soma do total vendido.
        const agendamentosAtivos = (agendamentos || []).filter(
            ag => !(ag.status || "").toLowerCase().includes("cancel")
        );

        atualizarTotalVendas(agendamentosAtivos);
    } catch (error) {
        console.error("Erro ao buscar total de vendas do mês:", error);
    }
}

// Normaliza "HH:MM:SS"/"HH:MM" para "HH:MM" (24h)
function formatarHorario24h(horario24) {
    if (!horario24) return '--:--';
    const [horaStr, minutoStr] = horario24.split(':');
    return `${horaStr.padStart(2, '0')}:${minutoStr}`;
}

function atualizarContadorAgendamentos(total) {
    // Alvo: O span titulo2 dentro do card total_agendamentos
    const elContador = document.querySelector(".total_agendamentos .titulo2");
    if (elContador) elContador.innerText = total;
}

function formatarMoeda(valor) {
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

function atualizarTotalVendas(agendamentos) {
    const total = agendamentos.reduce((soma, ag) => soma + Number(ag.valor_servico || 0), 0);
    const elVendas = document.querySelector(".vendas .titulo2");
    if (elVendas) elVendas.innerText = formatarMoeda(total);
}

// Escapa texto vindo do banco (ex: nome que o cliente escolheu no cadastro)
// antes de inserir via innerHTML — evita XSS armazenado na agenda do barbeiro.
function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// Renderiza só a página atual (AGENDAMENTOS_POR_PAGINA itens), empilhados
// verticalmente como sempre foi — só a paginação é nova.
function renderizarPaginaAgendamentos() {
    const container = document.getElementById("container-lista-agendamentos");
    if (!container) return;
    container.innerHTML = "";

    const inicio = paginaAgendamentosAtual * AGENDAMENTOS_POR_PAGINA;
    const pagina = agendamentosDoDia.slice(inicio, inicio + AGENDAMENTOS_POR_PAGINA);

    if (pagina.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum agendamento nesse dia.</p>`;
    }

    pagina.forEach(ag => {
        const hora = formatarHorario24h(ag.horario_inicio);

        const item = document.createElement("div");
        item.className = "agendamento-item";

        item.innerHTML = `
    <button type="button" class="agendamento-cancelar-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
        </svg>
        <span>Cancelar<br>agendamento</span>
    </button>
    <div class="card agendamentos_por_ordem">
        <div class="agendamento-info">
            <span class="titulo1">Cliente</span>
            <span class="agendamento-valor">${escapeHtml(ag.nome_cliente)}</span>
            <span class="titulo1">Serviço</span>
            <span class="agendamento-valor">${escapeHtml(ag.nome_servico)}</span>
        </div>
        <div class="agendamento-horario">
            ${hora}
        </div>
    </div>
`;
        configurarSwipe(item, ag);
        container.appendChild(item);
    });

    atualizarSetasAgendamentos();
}

// Quantas páginas de AGENDAMENTOS_POR_PAGINA cabem na lista atual (mínimo 1,
// mesmo com lista vazia, pra não dividir por zero nem exibir "página 0 de 0").
function totalPaginasAgendamentos() {
    return Math.max(1, Math.ceil(agendamentosDoDia.length / AGENDAMENTOS_POR_PAGINA));
}

// No dia de HOJE, começa na página que contém o primeiro agendamento a partir
// da hora atual em diante — pedido do usuário ("são 15h agora, mostra a
// partir das 15h"). Num dia passado/futuro não existe "agora" pra comparar,
// então começa sempre na primeira página.
function calcularPaginaInicial(dataDoDia, agendamentos) {
    if (dataDoDia !== formatarDataBanco(new Date())) return 0;

    const horaAgora = formatarHorario24h(
        `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`
    );

    const indice = agendamentos.findIndex(ag => formatarHorario24h(ag.horario_inicio) >= horaAgora);
    if (indice === -1) return 0;

    return Math.floor(indice / AGENDAMENTOS_POR_PAGINA);
}

// Habilita/desabilita as setas e atualiza "página X de Y" conforme a posição atual.
function atualizarSetasAgendamentos() {
    const btnAnterior = document.getElementById("btn-agendamentos-anterior");
    const btnProximo = document.getElementById("btn-agendamentos-proximo");
    const elInfo = document.getElementById("agendamentos-pagina-info");
    if (!btnAnterior || !btnProximo) return;

    const totalPaginas = totalPaginasAgendamentos();

    btnAnterior.disabled = paginaAgendamentosAtual <= 0;
    btnProximo.disabled = paginaAgendamentosAtual >= totalPaginas - 1;

    if (elInfo) elInfo.textContent = `${paginaAgendamentosAtual + 1} de ${totalPaginas}`;
}

function mudarPaginaAgendamentos(direcao) {
    const totalPaginas = totalPaginasAgendamentos();
    const novaPagina = paginaAgendamentosAtual + direcao;
    if (novaPagina < 0 || novaPagina >= totalPaginas) return;

    paginaAgendamentosAtual = novaPagina;
    renderizarPaginaAgendamentos();
}

function configurarSetasAgendamentos() {
    const btnAnterior = document.getElementById("btn-agendamentos-anterior");
    const btnProximo = document.getElementById("btn-agendamentos-proximo");
    if (!btnAnterior || !btnProximo) return;

    btnAnterior.addEventListener("click", () => mudarPaginaAgendamentos(-1));
    btnProximo.addEventListener("click", () => mudarPaginaAgendamentos(1));
}

// O card azul (.agendamentos_por_ordem) fica parado — quem se move é o botão
// vermelho, que desliza por cima vindo da direita e cobre a área do horário.
function configurarSwipe(item, ag) {
    const botao = item.querySelector(".agendamento-cancelar-btn");
    let inicioX = 0;
    let deslocamentoInicial = 0; // 0 = fechado, LARGURA_BOTAO_CANCELAR = totalmente aberto
    let deslocamentoAtual = 0;
    let arrastando = false;

    item.addEventListener("pointerdown", (evento) => {
        // Sem isso, no desktop o navegador entende o clique-e-arrasto como seleção
        // de texto (ou início de um drag nativo) em vez do gesto de swipe.
        evento.preventDefault();

        // Fecha qualquer outro card aberto antes de começar a arrastar este.
        document.querySelectorAll(".agendamento-item.aberto").forEach(outro => {
            if (outro !== item) fecharCard(outro);
        });

        inicioX = evento.clientX;
        deslocamentoInicial = item.classList.contains("aberto") ? LARGURA_BOTAO_CANCELAR : 0;
        arrastando = true;
        botao.style.transition = "none";
        item.setPointerCapture(evento.pointerId);
    });

    item.addEventListener("pointermove", (evento) => {
        if (!arrastando) return;
        const delta = evento.clientX - inicioX; // negativo = arrastando pra esquerda
        deslocamentoAtual = Math.min(LARGURA_BOTAO_CANCELAR, Math.max(0, deslocamentoInicial - delta));
        botao.style.transform = `translateX(${LARGURA_BOTAO_CANCELAR - deslocamentoAtual}px)`;
    });

    const finalizarArraste = (evento) => {
        if (!arrastando) return;
        arrastando = false;
        botao.style.transition = "";

        // Toque/clique parado (sem arrastar) em cima do botão já revelado = cancelar.
        // Não dá pra confiar no evento "click" nativo do botão aqui: o
        // setPointerCapture no item muda o alvo dos eventos de ponteiro e, em
        // vários navegadores desktop, isso impede o "click" de disparar depois.
        const moveuPouco = Math.abs(evento.clientX - inicioX) < 5;
        const estavaAberto = item.classList.contains("aberto");
        if (moveuPouco && estavaAberto) {
            const retanguloBotao = botao.getBoundingClientRect();
            const tocouNoBotao = evento.clientX >= retanguloBotao.left && evento.clientX <= retanguloBotao.right
                && evento.clientY >= retanguloBotao.top && evento.clientY <= retanguloBotao.bottom;
            if (tocouNoBotao) {
                cancelarAgendamento(ag, item);
                return;
            }
        }

        if (deslocamentoAtual > LARGURA_BOTAO_CANCELAR / 2) {
            abrirCard(item);
        } else {
            fecharCard(item);
        }
    };

    item.addEventListener("pointerup", finalizarArraste);
    item.addEventListener("pointercancel", finalizarArraste);
}

function abrirCard(item) {
    item.classList.add("aberto");
    item.querySelector(".agendamento-cancelar-btn").style.transform = "translateX(0)";
}

function fecharCard(item) {
    item.classList.remove("aberto");
    item.querySelector(".agendamento-cancelar-btn").style.transform = `translateX(${LARGURA_BOTAO_CANCELAR}px)`;
}

async function cancelarAgendamento(ag, item) {
    if (!ag.id_agendamento) {
        console.error("Agendamento sem id_agendamento — não é possível cancelar. Verifique se a view vw_agenda_do_barbeiro expõe essa coluna.", ag);
        alert("Não foi possível cancelar: falta o identificador do agendamento.");
        return;
    }

    const confirmou = confirm(`Cancelar o agendamento de ${ag.nome_cliente}?`);
    if (!confirmou) {
        fecharCard(item);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("agendamento")
            .update({ status: "cancelado" })
            .eq("id_agendamento", ag.id_agendamento)
            .select();

        if (error) throw error;

        // Update sem erro mas 0 linhas afetadas quase sempre é RLS barrando
        // silenciosamente (a policy não reconheceu o barbeiro como dono do agendamento).
        if (!data || data.length === 0) {
            console.error("Update não afetou nenhuma linha — provável bloqueio de RLS na tabela agendamento.", ag);
            alert("Não foi possível cancelar: sem permissão para alterar este agendamento (RLS). Verifique a policy no Supabase.");
            fecharCard(item);
            return;
        }

        if (dataSelecionadaAtual) buscarAgendamentosDaAPI(dataSelecionadaAtual);
        buscarTotalVendasDoMes();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        alert("Não foi possível cancelar o agendamento. Tente novamente.");
        fecharCard(item);
    }
}

// Toca fora de qualquer card aberto para fechá-lo de volta.
document.addEventListener("pointerdown", (evento) => {
    document.querySelectorAll(".agendamento-item.aberto").forEach(item => {
        if (!item.contains(evento.target)) fecharCard(item);
    });
});