import { supabase } from "./supabase.js";
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

function gerarProximasDatas() {
    const datas = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (datas.length < DIAS_A_MOSTRAR) {
        if (cursor.getDay() !== 0) {
            // Nenhuma barbearia abre no domingo
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

    const { data: estabelecimento, error: erroEstabelecimento } = await supabase
        .from("estabelicimento")
        .select("aberto_sabado, nome_estabelicimento")
        .eq("id_estabelicimento", agendamento.id_estabelicimento)
        .single();

    if (erroEstabelecimento) {
        console.error("Erro ao buscar aberto_sabado da barbearia:", erroEstabelecimento);
    }

    // Sem informação = assume que abre normalmente aos sábados.
    const abertoSabado = estabelecimento?.aberto_sabado !== false;
    const nomeBarbearia = estabelecimento?.nome_estabelicimento || agendamento.nome_estabelicimento || "Esta barbearia";

    const datas = gerarProximasDatas();

    datas.forEach(data => {
        const ehSabado = data.getDay() === 6;

        const card = document.createElement("div");
        card.className = "card card-data";
        card.innerHTML = `
            <span class="data-dia">${data.getDate()} ${MESES[data.getMonth()]}</span>
            <span class="data-semana">${DIAS_SEMANA[data.getDay()]}</span>
        `;

        card.addEventListener("click", () => {
            if (ehSabado && !abertoSabado) {
                alert(`A Barbearia ${nomeBarbearia} trabalha com ordem de chegada aos sábados.`);
                return;
            }

            salvarEtapaAgendamento({
                data_agendamento: formatarDataBanco(data)
            });
            window.location.href = "selecionar_horario.html";
        });

        container.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarDatas();
    preencherCabecalhoCliente();
});
