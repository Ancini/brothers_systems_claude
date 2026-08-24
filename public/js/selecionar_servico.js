import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";

function formatarMoeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

// Promoção vale só pro dia exato cadastrado (ver public/js/cadastrar_promocao.js).
// A tela de Data agora vem antes da tela de Serviço no fluxo, então o desconto
// mostrado aqui já é o da data que o cliente escolheu — não o de hoje.
async function buscarPercentualPromocaoDaData(idEstabelecimento, dataAgendamento) {
    const { data, error } = await supabase
        .from("promocao")
        .select("percentual_desconto")
        .eq("id_estabelicimento", idEstabelecimento)
        .eq("data_promocao", dataAgendamento)
        .maybeSingle();

    if (error) {
        console.error("Erro ao buscar promoção da data escolhida:", error);
        return null;
    }

    return data?.percentual_desconto ?? null;
}

// Escapa texto vindo do banco antes de inserir via innerHTML — evita XSS armazenado.
function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

async function carregarServicos() {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_estabelicimento || !agendamento.id_prestador || !agendamento.data_agendamento) {
        alert("Faltam informações do agendamento. Voltando ao início...");
        window.location.href = "menu_cliente.html";
        return;
    }

    const [{ data, error }, percentualPromocao] = await Promise.all([
        supabase
            .from("servico_estabelicimento")
            .select(`
                id_servico_estabelicimento,
                valor_servico,
                tempo_servico,
                servico:id_servico ( id_servico, nome_servico, pontuacao_servico )
            `)
            .eq("id_estabelicimento", agendamento.id_estabelicimento),
        buscarPercentualPromocaoDaData(agendamento.id_estabelicimento, agendamento.data_agendamento)
    ]);

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
        const temPromocao = percentualPromocao != null;
        const valorFinal = temPromocao
            ? item.valor_servico * (1 - percentualPromocao / 100)
            : item.valor_servico;

        const card = document.createElement("div");
        card.className = "card barbeiros";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="css/imagens/servico.png" alt="servico" class="desenho_barbeiro">
            <div class="texto_barbeiros">
                <span class="titulo5">${escapeHtml(nome)}</span>
                ${temPromocao ? `
                    <span class="promocao-badge">${percentualPromocao}% OFF</span>
                    <span class="valor-servico valor-original">${formatarMoeda(item.valor_servico)}</span>
                    <span class="valor-servico valor-promocional">${formatarMoeda(valorFinal)}</span>
                ` : `
                    <span class="valor-servico">${formatarMoeda(item.valor_servico)}</span>
                `}
            </div>
        `;

        card.addEventListener("click", () => {
            salvarEtapaAgendamento({
                id_servico_estabelicimento: item.id_servico_estabelicimento,
                nome_servico: nome,
                valor_servico: valorFinal,
                tempo_servico: item.tempo_servico
            });
            window.location.href = "selecionar_horario.html";
        });

        container.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarServicos();
    preencherCabecalhoCliente();
});
