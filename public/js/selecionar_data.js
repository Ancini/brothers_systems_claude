import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";

const DIAS_A_MOSTRAR = 9;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Máximo de dias corridos que a busca avança tentando achar DIAS_A_MOSTRAR
// dias abertos — evita loop infinito caso a barbearia esteja fechada todo dia.
const LIMITE_DIAS_VARRIDOS = 60;

// Anda dia a dia a partir de hoje, pulando os que "diaEstaAberto" reprovar,
// até juntar DIAS_A_MOSTRAR datas válidas (ou bater o limite de segurança).
function gerarProximasDatasAbertas(diaEstaAberto) {
    const datas = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < LIMITE_DIAS_VARRIDOS && datas.length < DIAS_A_MOSTRAR; i++) {
        if (diaEstaAberto(cursor.getDay())) {
            datas.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return datas;
}

async function carregarDatas() {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_estabelicimento) {
        alert("Nenhuma barbearia selecionada. Voltando ao menu...");
        window.location.href = "menu_cliente.html";
        return;
    }

    const container = document.getElementById("lista-datas");
    if (!container) {
        console.warn("Container 'lista-datas' não encontrado no HTML.");
        return;
    }
    container.innerHTML = "";
    container.className = "grade-datas";

    // Dias da semana em que essa barbearia atende (tabela horario_funcionamento,
    // uma linha por dia — ver public/cadastrar_dias_funcionamento.html).
    const { data: diasFuncionamento, error: erroDiasFuncionamento } = await supabase
        .from("horario_funcionamento")
        .select("dia_semana, aberto")
        .eq("id_estabelicimento", agendamento.id_estabelicimento);

    if (erroDiasFuncionamento) {
        console.error("Erro ao buscar horario_funcionamento:", erroDiasFuncionamento);
    }

    const abertoPorDia = new Map((diasFuncionamento || []).map(linha => [linha.dia_semana, linha.aberto]));

    // Se a barbearia ainda não configurou nenhum dia na tela nova, mantém o
    // comportamento antigo como fallback: todo mundo aberto, menos domingo.
    function diaEstaAberto(diaSemana) {
        if (abertoPorDia.has(diaSemana)) return abertoPorDia.get(diaSemana);
        return diaSemana !== 0;
    }

    // Datas em que o cliente já tem agendamento marcado (pra avisar antes de deixar marcar de novo).
    const datasComAgendamento = new Set();
    const usuario = pegarSessao();
    if (usuario?.id_usuario) {
        const { data: meusAgendamentos, error: erroMeusAgendamentos } = await supabase
            .from("vw_meus_agendamentos")
            .select("data_agendamento, status")
            .eq("id_usuario", usuario.id_usuario);

        if (erroMeusAgendamentos) {
            console.error("Erro ao verificar agendamentos existentes do cliente:", erroMeusAgendamentos);
        } else {
            (meusAgendamentos || [])
                .filter(a => !(a.status || "").toLowerCase().includes("cancel"))
                .forEach(a => datasComAgendamento.add(a.data_agendamento));
        }
    }

    const datas = gerarProximasDatasAbertas(diaEstaAberto);

    datas.forEach(data => {
        const card = document.createElement("div");
        card.className = "card card-data";
        card.innerHTML = `
            <span class="data-dia">${data.getDate()} ${MESES[data.getMonth()]}</span>
            <span class="data-semana">${DIAS_SEMANA[data.getDay()]}</span>
        `;

        card.addEventListener("click", () => {
            const dataFormatada = formatarDataBanco(data);

            if (datasComAgendamento.has(dataFormatada)) {
                const confirmar = confirm("Você já agendou um horário nesse dia. Tem certeza que deseja marcar um novo horário?");
                if (!confirmar) return;
            }

            salvarEtapaAgendamento({
                data_agendamento: dataFormatada
            });
            window.location.href = "selecionar_horario.html";
        });

        container.appendChild(card);
    });

    if (datas.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum dia disponível pra essa barbearia no momento.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarDatas();
    preencherCabecalhoCliente();
});
