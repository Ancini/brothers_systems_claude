import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";
import { preencherCabecalhoCliente } from "./cabecalho_cliente.js";

function formatarMoeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function dataDeHojeBanco() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Promoção vale só pro dia de hoje (ver public/js/cadastrar_promocao.js) —
// aqui ainda não existe data escolhida no fluxo, então o desconto mostrado
// reflete a promoção de hoje mesmo.
async function buscarPercentualPromocaoHoje(idEstabelecimento) {
    const { data, error } = await supabase
        .from("promocao")
        .select("percentual_desconto")
        .eq("id_estabelicimento", idEstabelecimento)
        .eq("data_promocao", dataDeHojeBanco())
        .maybeSingle();

    if (error) {
        console.error("Erro ao buscar promoção de hoje:", error);
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

    if (!agendamento || !agendamento.id_estabelicimento) {
        alert("Nenhuma barbearia selecionada. Voltando ao menu...");
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
        buscarPercentualPromocaoHoje(agendamento.id_estabelicimento)
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
            window.location.href = "selecionar_data.html";
        });

        container.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarServicos();
    preencherCabecalhoCliente();
});
