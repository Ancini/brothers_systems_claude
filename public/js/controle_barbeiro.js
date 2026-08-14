// 1. CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://hnaapsbkrokrkmnzayyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let idBarbeiroLogado = null; 

document.addEventListener("DOMContentLoaded", async () => {
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

// 2. GERA OS 4 DIAS DINAMICAMENTE
function inicializarLinhaDoTempo() {
    const containerDias = document.querySelector(".linha-tempo-dias");
    containerDias.innerHTML = ""; 

    for (let i = 0; i < 3; i++) {
        const dataRef = new Date();
        dataRef.setDate(dataRef.getDate() + i);
        const dataFormatadaBanco = dataRef.toISOString().split('T')[0];
        
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
            buscarAgendamentosDaAPI(dataFormatadaBanco);
        });
        containerDias.appendChild(cardDia);
    }
    buscarAgendamentosDaAPI(new Date().toISOString().split('T')[0]);
}

// 3. BUSCA E RENDERIZAÇÃO
async function buscarAgendamentosDaAPI(dataFiltro) {
    if (!idBarbeiroLogado) return;

    const dataInicio = `${dataFiltro}T00:00:00`;
    const date = new Date(dataFiltro);
    date.setDate(date.getDate() + 1);
    const dataFim = date.toISOString().split('T')[0] + 'T00:00:00';

    try {
        const { data: agendamentos, error } = await supabaseClient
            .from('vw_agenda_do_barbeiro')
            .select('*')
            .eq('id_prestador', idBarbeiroLogado)
            .gte('data_agendamento', dataInicio)
            .lt('data_agendamento', dataFim)
            .order('horario_inicio', { ascending: true });

        if (error) throw error;
        
        atualizarContadorAgendamentos(agendamentos ? agendamentos.length : 0);
        renderizarAgendamentos(agendamentos || []);
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
            .select('valor_servico')
            .eq('id_prestador', idBarbeiroLogado)
            .gte('data_agendamento', dataInicio)
            .lt('data_agendamento', dataFim);

        if (error) throw error;

        atualizarTotalVendas(agendamentos || []);
    } catch (error) {
        console.error("Erro ao buscar total de vendas do mês:", error);
    }
}

// Converte "HH:MM:SS"/"HH:MM" (24h) para { hora: "HH:MM", periodo: "AM"/"PM" }
function formatarHorario12h(horario24) {
    if (!horario24) return { hora: '--:--', periodo: '' };
    const [horaStr, minutoStr] = horario24.split(':');
    let hora = parseInt(horaStr, 10);
    const periodo = hora >= 12 ? 'PM' : 'AM';
    hora = hora % 12;
    if (hora === 0) hora = 12;
    return { hora: `${String(hora).padStart(2, '0')}:${minutoStr}`, periodo };
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

function renderizarAgendamentos(agendamentos) {
    const container = document.getElementById("container-lista-agendamentos");
    if (!container) return;
    container.innerHTML = "";

    agendamentos.forEach(ag => {
        const card = document.createElement("div");
        card.className = "card agendamentos_por_ordem";

        const { hora, periodo } = formatarHorario12h(ag.horario_inicio);

        card.innerHTML = `
    <div class="agendamento-info">
        <span class="titulo1">Cliente</span>
        <span class="titulo2 agendamento-valor">${ag.nome_cliente}</span>
        <span class="titulo1 agendamento-servico">Serviço</span>
        <span class="titulo2 agendamento-valor">${ag.nome_servico}</span>
    </div>
    <div class="agendamento-horario">
        ${hora}<span class="periodo">${periodo}</span>
    </div>
`;
        container.appendChild(card);
    });
}