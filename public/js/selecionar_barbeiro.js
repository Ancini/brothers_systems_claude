import { supabase } from "./supabase.js";
import { pegarAgendamentoEmAndamento, salvarEtapaAgendamento } from "./agendamento_estado.js";

async function carregarBarbeiros() {
    const agendamento = pegarAgendamentoEmAndamento();

    if (!agendamento || !agendamento.id_estabelicimento) {
        alert("Nenhuma barbearia selecionada. Voltando ao menu...");
        window.location.href = "menu_cliente.html";
        return;
    }

    const nomeSpan = document.getElementById("nome-barbearia-selecionada");
    if (nomeSpan) nomeSpan.textContent = agendamento.nome_estabelicimento || "";

   const { data, error } = await supabase
    .from("prestador")
    .select(`
        id_prestador,
        usuario:prestador_id_prestador_fkey ( nome_usuario )
    `)
    .eq("id_estabelicimento", agendamento.id_estabelicimento);

    const container = document.getElementById("lista-barbeiros");
    if (!container) {
        console.warn("Container 'lista-barbeiros' não encontrado no HTML.");
        return;
    }
    container.innerHTML = "";

    if (error) {
        console.error("Erro ao buscar barbeiros:", error);
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Erro ao carregar barbeiros.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Nenhum barbeiro cadastrado nesta barbearia.</p>`;
        return;
    }

    data.forEach(prestador => {
        const nome = prestador.usuario?.nome_usuario || "Barbeiro";

        const card = document.createElement("div");
        card.className = "card barbeiros";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="css/imagens/desenho_barbeiro.png" alt="desenho_barbeiro" class="desenho_barbeiro">
            <div class="texto_barbeiros">
                <span class="titulo5">${nome}</span>
            </div>
        `;

        card.addEventListener("click", () => {
            salvarEtapaAgendamento({
                id_prestador: prestador.id_prestador,
                nome_prestador: nome
            });
            window.location.href = "tela_selecionar_servico.html";
        });

        container.appendChild(card);
    });
}

function configurarBotaoVoltar() {
    const btnVoltar = document.getElementById("btn-voltar");
    if (btnVoltar) {
        btnVoltar.addEventListener("click", () => {
            window.location.href = "menu_cliente.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarBarbeiros();
    configurarBotaoVoltar();
});
