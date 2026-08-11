import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";

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

function carregarDatas() {
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

    const datas = gerarProximasDatas();

    for (let i = 0; i < datas.length; i += 3) {
        const linha = document.createElement("div");
        linha.className = "horario";

        datas.slice(i, i + 3).forEach(data => {
            const card = document.createElement("div");
            card.className = "card selecionar_horario";
            card.innerHTML = `
                <div class="texto-horario">
                    <span class="titulo6">${data.getDate()} ${MESES[data.getMonth()]}</span>
                    <br>
                    <span class="titulo7">${DIAS_SEMANA[data.getDay()]}</span>
                </div>
            `;

            card.addEventListener("click", () => {
                salvarEtapaAgendamento({
                    data_agendamento: formatarDataBanco(data)
                });
                window.location.href = "selecionar_horario.html";
            });

            linha.appendChild(card);
        });

        container.appendChild(linha);
    }
}

document.addEventListener("DOMContentLoaded", carregarDatas);
