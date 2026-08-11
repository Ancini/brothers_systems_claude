import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";

const INTERVALO_MINUTOS = 30;

function paraMinutos(horaTexto) {
    const [h, m] = horaTexto.split(":").map(Number);
    return h * 60 + m;
}

function paraHoraTexto(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}`;
}

function horariosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
    return inicioA < fimB && fimA > inicioB;
}

async function carregarHorarios() {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_estabelicimento || !agendamento.id_prestador || !agendamento.data_agendamento) {
        alert("Faltam informações do agendamento. Voltando ao início...");
        window.location.href = "menu_cliente.html";
        return;
    }

    const container = document.getElementById("lista-horarios");
    if (!container) {
        console.warn("Container 'lista-horarios' não encontrado no HTML.");
        return;
    }
    container.innerHTML = "";
    container.className = "grade-horarios";

    const duracaoServico = agendamento.tempo_servico || 30;

    const { data: estabelecimento, error: erroEstabelecimento } = await supabase
        .from("estabelicimento")
        .select("horario_abertura, horario_fechamento")
        .eq("id_estabelicimento", agendamento.id_estabelicimento)
        .single();

    if (erroEstabelecimento || !estabelecimento) {
        console.error("Erro ao buscar horário de funcionamento:", erroEstabelecimento);
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Não foi possível carregar os horários.</p>`;
        return;
    }

    const { data: ocupados, error: erroOcupados } = await supabase
        .from("vw_horarios_ocupados")
        .select("horario_inicio, horario_fim, status")
        .eq("id_prestador", agendamento.id_prestador)
        .eq("data_agendamento", agendamento.data_agendamento);

    if (erroOcupados) {
        console.error("Erro ao buscar horários ocupados:", erroOcupados);
    }

    const inicioMin = paraMinutos(estabelecimento.horario_abertura);
    const fimMin = paraMinutos(estabelecimento.horario_fechamento);

    const ocupadosMin = (ocupados || [])
        .filter(o => !(o.status || "").toLowerCase().includes("cancel"))
        .map(o => ({
            inicio: paraMinutos(o.horario_inicio),
            fim: paraMinutos(o.horario_fim)
        }));

    const disponiveis = [];
    for (let slot = inicioMin; slot + duracaoServico <= fimMin; slot += INTERVALO_MINUTOS) {
        const fimSlot = slot + duracaoServico;
        const conflita = ocupadosMin.some(o => horariosSeSobrepoem(slot, fimSlot, o.inicio, o.fim));
        if (!conflita) {
            disponiveis.push(slot);
        }
    }

    if (disponiveis.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum horário disponível nesse dia.</p>`;
        return;
    }

    disponiveis.forEach(slot => {
        const horaInicio = paraHoraTexto(slot);
        const horaFim = paraHoraTexto(slot + duracaoServico);

        const card = document.createElement("div");
        card.className = "card card-horario";
        card.innerHTML = `<span class="hora-texto">${horaInicio}</span>`;

        card.addEventListener("click", () => {
            salvarEtapaAgendamento({
                horario_inicio: `${horaInicio}:00`,
                horario_fim: `${horaFim}:00`
            });
            window.location.href = "confirmacao_agendamento.html";
        });

        container.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", carregarHorarios);