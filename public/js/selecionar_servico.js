import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";

function formatarMoeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

async function carregarServicos() {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_estabelicimento) {
        alert("Nenhuma barbearia selecionada. Voltando ao menu...");
        window.location.href = "menu_cliente.html";
        return;
    }

    const { data, error } = await supabase
        .from("servico_estabelicimento")
        .select(`
            id_servico_estabelicimento,
            valor_servico,
            tempo_servico,
            servico:id_servico ( id_servico, nome_servico, pontuacao_servico )
        `)
        .eq("id_estabelicimento", agendamento.id_estabelicimento);

    const container = document.getElementById("lista-servicos");
    if (!container) {
        console.warn("Container 'lista-servicos' não encontrado no HTML.");
        return;
    }
    container.innerHTML = "";

    if (error) {
        console.error("Erro ao buscar serviços:", error);
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Erro ao carregar serviços.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum serviço cadastrado nesta barbearia.</p>`;
        return;
    }

    data.forEach(item => {
        const nome = item.servico?.nome_servico || "Serviço";

        const card = document.createElement("div");
        card.className = "card barbeiros";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="css/imagens/servico.png" alt="servico" class="desenho_barbeiro">
            <div class="texto_barbeiros">
                <span class="titulo5">${nome}</span>
                <span class="valor-servico">${formatarMoeda(item.valor_servico)}</span>
            </div>
        `;

        card.addEventListener("click", () => {
            salvarEtapaAgendamento({
                id_servico_estabelicimento: item.id_servico_estabelicimento,
                nome_servico: nome,
                valor_servico: item.valor_servico,
                tempo_servico: item.tempo_servico
            });
            window.location.href = "selecionar_data.html";
        });

        container.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarServicos();
    preencherCabecalhoCliente();
});
