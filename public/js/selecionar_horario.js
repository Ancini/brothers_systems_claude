import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";
import { pegarAjustesProvisorios } from "./ajustes_provisorios_agenda.js";

const SLOTS_POR_PAGINA = 9;

// Intervalo de almoço fixo, aplicado a todas as barbearias por enquanto.
// Ainda não existe configuração por barbearia no banco (isso deve virar
// uma tela do barbeiro na versão Dart, permitindo cada um definir o próprio horário).
const ALMOCO_INICIO_MIN = 12 * 60;
const ALMOCO_FIM_MIN = 13 * 60 + 30;

function paraMinutos(horaTexto) {
    const [h, m] = horaTexto.split(":").map(Number);
    return h * 60 + m;
}

function paraHoraTexto(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}`;
}

// Junta blocos ocupados que se sobrepõem/encostam num só, pra sobrar só os
// intervalos realmente ocupados (já ordenados por horário de início).
function mesclarBloqueios(blocos) {
    const ordenados = [...blocos].sort((a, b) => a.inicio - b.inicio);
    const mesclados = [];

    for (const bloco of ordenados) {
        const ultimo = mesclados[mesclados.length - 1];
        if (ultimo && bloco.inicio <= ultimo.fim) {
            ultimo.fim = Math.max(ultimo.fim, bloco.fim);
        } else {
            mesclados.push({ ...bloco });
        }
    }

    return mesclados;
}

// Descobre as janelas livres entre a abertura e o fechamento, descontando
// os bloqueios (agendamentos existentes + almoço) já mesclados.
function montarJanelasLivres(inicioMin, fimMin, bloqueios) {
    const janelas = [];
    let cursor = inicioMin;

    for (const bloco of bloqueios) {
        if (bloco.inicio > cursor) {
            janelas.push({ inicio: cursor, fim: bloco.inicio });
        }
        cursor = Math.max(cursor, bloco.fim);
    }

    if (cursor < fimMin) {
        janelas.push({ inicio: cursor, fim: fimMin });
    }

    return janelas;
}

// Dia da semana (0=domingo...6=sábado) de uma data "YYYY-MM-DD", sem passar por UTC
function diaDaSemana(dataBanco) {
    const [ano, mes, dia] = dataBanco.split("-").map(Number);
    return new Date(ano, mes - 1, dia).getDay();
}

// "YYYY-MM-DD" de hoje no fuso local (mesmo formato salvo em data_agendamento)
function dataDeHojeBanco() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
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
    container.className = "horarios-carrossel";

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
    let fimMin = paraMinutos(estabelecimento.horario_fechamento);

    // Ajuste provisório por estabelecimento (ver ajustes_provisorios_agenda.js).
    const ajustesProvisorios = pegarAjustesProvisorios(agendamento.id_estabelicimento);
    if (ajustesProvisorios?.fechamentoSabadoMin != null && diaDaSemana(agendamento.data_agendamento) === 6) {
        fimMin = Math.min(fimMin, ajustesProvisorios.fechamentoSabadoMin);
    }

    const ocupadosMin = (ocupados || [])
        .filter(o => !(o.status || "").toLowerCase().includes("cancel"))
        .map(o => ({
            inicio: paraMinutos(o.horario_inicio),
            fim: paraMinutos(o.horario_fim)
        }));
    ocupadosMin.push({ inicio: ALMOCO_INICIO_MIN, fim: ALMOCO_FIM_MIN });

    const ehHoje = agendamento.data_agendamento === dataDeHojeBanco();
    const agora = new Date();
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();

    // Agenda dinâmica: em vez de uma grade fixa de 30 em 30, os horários são
    // encadeados a partir da duração real de cada serviço. Ex: um corte de 30min
    // marcado às 9h libera o próximo horário já às 9h30; uma barba de 20min
    // marcada em seguida libera o próximo já às 9h50 — sem "buracos" de grade fixa.
    const bloqueios = mesclarBloqueios(ocupadosMin);
    const janelasLivres = montarJanelasLivres(inicioMin, fimMin, bloqueios);

    const disponiveis = [];
    janelasLivres.forEach(janela => {
        for (let slot = janela.inicio; slot + duracaoServico <= janela.fim; slot += duracaoServico) {
            if (ehHoje && slot <= agoraMin) {
                continue;
            }
            disponiveis.push(slot);
        }
    });

    if (disponiveis.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum horário disponível nesse dia.</p>`;
        return;
    }

    for (let i = 0; i < disponiveis.length; i += SLOTS_POR_PAGINA) {
        const pagina = document.createElement("div");
        pagina.className = "pagina-horarios";

        disponiveis.slice(i, i + SLOTS_POR_PAGINA).forEach(slot => {
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

            pagina.appendChild(card);
        });

        container.appendChild(pagina);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarHorarios();
    preencherCabecalhoCliente();
});
