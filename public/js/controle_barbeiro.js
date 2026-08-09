// 1. CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://hnaapsbkrokrkmnzayyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let idBarbeiroLogado = null; 

document.addEventListener("DOMContentLoaded", async () => {
    const sucesso = await inicializarIdentidadeBarbeiro();
    if (sucesso) {
        inicializarLinhaDoTempo();
    } else {
        console.error("Não foi possível identificar o barbeiro. Verifique o login ou o vínculo no banco.");
    }
});

// FUNÇÃO DA PONTE
async function inicializarIdentidadeBarbeiro() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    const { data: vinculo, error } = await supabaseClient
        .from('prestador')
        .select('id_prestador')
        .eq('uuid_vinculo', user.id) 
        .limit(1); 

    if (error || !vinculo || vinculo.length === 0) return false;
    
    idBarbeiroLogado = vinculo[0].id_prestador;
    return true;
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

function atualizarContadorAgendamentos(total) {
    // Alvo: O span titulo2 dentro do card total_agendamentos
    const elContador = document.querySelector(".total_agendamentos .titulo2");
    if (elContador) elContador.innerText = total;
}

function renderizarAgendamentos(agendamentos) {
    const container = document.getElementById("container-lista-agendamentos");
    if (!container) return;
    container.innerHTML = "";

    agendamentos.forEach(ag => {
        const card = document.createElement("div");
        card.className = "card agendamentos_por_ordem";
        
        // Dentro da função renderizarAgendamentos, no forEach:
card.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
        <span class="titulo1">Cliente</span>
        <span class="titulo2" style="font-size: 22px; font-weight: bold;">${ag.nome_cliente}</span>
        <span class="titulo1" style="margin-top: 5px;">Serviço</span>
        <span class="titulo2" style="font-size: 22px; font-weight: bold;">${ag.nome_servico}</span>
    </div>
    <div style="position: absolute; right: 30px; top: 50%; transform: translateY(-50%); font-size: 45px; font-family: Georgia, serif;">
        ${ag.horario_inicio ? ag.horario_inicio.substring(0, 5) : '--:--'}
    </div>
`;
        container.appendChild(card);
    });
}