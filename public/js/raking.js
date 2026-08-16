import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const TOP_N = 8;

function criarItemRanking(posicao, nome, pontos) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<span>${posicao}º ${nome}</span><span>${String(pontos).padStart(2, "0")} pt</span>`;
    return item;
}

async function carregarCabecalhoCliente(usuario) {
    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";
    const elNome = document.getElementById("cliente-nome");
    if (elNome) elNome.textContent = nomeCompleto.split(" ")[0];

    if (!usuario.id_usuario) return;

    const [agendamentosResp, pontuacaoResp] = await Promise.all([
        supabase
            .from("vw_meus_agendamentos")
            .select("id_agendamento", { count: "exact", head: true })
            .eq("id_usuario", usuario.id_usuario),
        supabase
            .from("vw_pontuacao_usuario")
            .select("pontuacao_total")
            .eq("id_usuario", usuario.id_usuario)
            .single()
    ]);

    if (agendamentosResp.error) {
        console.error("Erro ao buscar total de agendamentos:", agendamentosResp.error);
    } else {
        const elAgendamentos = document.getElementById("stat-agendamentos");
        if (elAgendamentos) elAgendamentos.textContent = agendamentosResp.count ?? 0;
    }

    if (pontuacaoResp.error) {
        console.error("Erro ao buscar pontuação:", pontuacaoResp.error);
    } else {
        const elPontuacao = document.getElementById("stat-pontuacao");
        if (elPontuacao) elPontuacao.textContent = pontuacaoResp.data?.pontuacao_total ?? 0;
    }
}

// Ranking é global (a view vw_pontuacao_usuario ainda não tem id_estabelicimento
// pra permitir separar por barbearia)
async function carregarRanking(usuario) {
    const container = document.querySelector(".lista-ranking");
    if (!container) return;

    const { data, error } = await supabase
        .from("vw_pontuacao_usuario")
        .select("id_usuario, usuario, pontuacao_total")
        .order("pontuacao_total", { ascending: false });

    if (error || !data) {
        console.error("Erro ao carregar ranking:", error);
        container.innerHTML = `<p class="ranking-carregando">Erro ao carregar o ranking.</p>`;
        return;
    }

    container.innerHTML = "";

    data.slice(0, TOP_N).forEach((linha, indice) => {
        container.appendChild(criarItemRanking(indice + 1, linha.usuario, linha.pontuacao_total));
    });

    if (!usuario?.id_usuario) return;

    const posicaoCliente = data.findIndex(linha => linha.id_usuario === usuario.id_usuario);
    if (posicaoCliente >= TOP_N) {
        const linhaCliente = data[posicaoCliente];
        const itemCliente = criarItemRanking(posicaoCliente + 1, linhaCliente.usuario, linhaCliente.pontuacao_total);
        itemCliente.classList.add("item-atual");
        container.appendChild(itemCliente);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const usuario = pegarSessao();

    if (usuario) {
        carregarCabecalhoCliente(usuario);
    }
    carregarRanking(usuario);
});
