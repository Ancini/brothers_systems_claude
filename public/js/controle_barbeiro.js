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