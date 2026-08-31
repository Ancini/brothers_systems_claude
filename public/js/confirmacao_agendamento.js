import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";
import { pegarAgendamentoEmAndamento, limparAgendamentoEmAndamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";
import { enviarPush } from "./push.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function formatarHora12h(horaTexto) {
    if (!horaTexto) return "--:--";
    const [h, m] = horaTexto.split(":").map(Number);
    const periodo = h < 12 ? "AM" : "PM";
    const hora12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(hora12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${periodo}`;
}

function formatarData(dataTexto) {
    if (!dataTexto) return "-";
    const [ano, mes, dia] = dataTexto.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    return `${String(dia).padStart(2, "0")} de ${MESES[mes - 1]}<br>${DIAS_SEMANA[data.getDay()]}`;
}

// Versão em texto puro (sem <br>), pro corpo do push — "01 de junho", não
// dá pra usar formatarData ali porque ela devolve HTML.
function formatarDataExtensa(dataTexto) {
    if (!dataTexto) return "-";
    const [, mes, dia] = dataTexto.split("-");
    return `${dia} de ${MESES[Number(mes) - 1]}`;
}

// Horário em 24h (o banco já guarda assim, só corta os segundos) — usado no
// push em vez de formatarHora12h, que é só pro resumo na tela.
function formatarHora24h(horaTexto) {
    if (!horaTexto) return "--:--";
    const [h, m] = horaTexto.split(":");
    return `${h.padStart(2, "0")}:${m}`;
}

function exibirResumo(agendamento) {
    const elBarbeiro = document.getElementById("nome-barbeiro-confirmacao");
    const elServico = document.getElementById("nome-servico-confirmacao");
    const elHora = document.getElementById("hora-confirmacao");
    const elData = document.getElementById("data-confirmacao");

    if (elBarbeiro) elBarbeiro.textContent = agendamento.nome_prestador || "-";
    if (elServico) elServico.textContent = agendamento.nome_servico || "-";
    if (elHora) elHora.textContent = formatarHora12h(agendamento.horario_inicio);
    if (elData) elData.innerHTML = formatarData(agendamento.data_agendamento);
}

async function confirmarAgendamento(agendamento) {
    const usuario = pegarSessao();

    if (!usuario || !usuario.id_usuario) {
        alert("Você precisa estar logado para confirmar o agendamento.");
        window.location.href = "index.html";
        return;
    }

    const { error } = await supabase.from("agendamento").insert({
        id_usuario: usuario.id_usuario,
        id_servico_estabelicimento: agendamento.id_servico_estabelicimento,
        id_estabelicimento: agendamento.id_estabelicimento,
        id_prestador: agendamento.id_prestador,
        data_agendamento: agendamento.data_agendamento,
        horario_inicio: agendamento.horario_inicio,
        horario_fim: agendamento.horario_fim
    });

    if (error) {
        console.error("Erro ao confirmar agendamento:", error);
        alert("Não foi possível confirmar o agendamento. Tente novamente.");
        return;
    }

    limparAgendamentoEmAndamento();

    // Não espera (fire-and-forget) — notificação é bônus, não pode atrasar o
    // redirecionamento nem quebrar o fluxo se falhar (enviarPush já não lança).
    enviarPush({
        id_usuario: usuario.id_usuario,
        titulo: "Agendamento confirmado! ✅",
        corpo: `Seu horário com ${agendamento.nome_prestador || "o barbeiro"} foi confirmado para ${formatarHora12h(agendamento.horario_inicio)}.`,
        url: "meusAgendamentos.html"
    });

    if (agendamento.id_prestador) {
        enviarPush({
            id_usuario: agendamento.id_prestador,
            titulo: "Novo agendamento! 📅",
            corpo: `${usuario.nome || usuario.user_metadata?.name || "Um cliente"} marcou um horário dia ${formatarDataExtensa(agendamento.data_agendamento)} às ${formatarHora24h(agendamento.horario_inicio)}.`,
            url: "menu_inicial_barbeiro.html"
        });
    }

    window.location.href = "agendamento_confirmado.html";
}

function configurarBotoes(agendamento) {
    const btnEditar = document.getElementById("btn-editar");
    const btnCancelar = document.getElementById("btn-cancelar");
    const btnConfirmar = document.getElementById("btn-confirmar");

    if (btnEditar) {
        btnEditar.addEventListener("click", () => {
            window.location.href = "agendamento_selecionar_barbearia.html";
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            limparAgendamentoEmAndamento();
            window.location.href = "agendamento_cancelado.html";
        });
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener("click", () => confirmarAgendamento(agendamento));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_prestador || !agendamento.horario_inicio) {
        alert("Nenhum agendamento em andamento. Voltando ao menu...");
        window.location.href = "menu_cliente.html";
        return;
    }

    exibirResumo(agendamento);
    configurarBotoes(agendamento);
    preencherCabecalhoCliente();
});
