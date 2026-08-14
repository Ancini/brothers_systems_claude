import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

// Preenche o cabeçalho comum (Cliente / Meus agendamentos / Pontuação)
// usado em várias telas do fluxo de agendamento.
export async function preencherCabecalhoCliente() {
    const usuario = pegarSessao();
    if (!usuario) return;

    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";
    const elNome = document.querySelector(".card.barbeiro .titulo2");
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
        const elAgendamentos = document.querySelector(".card.total_agendamentos .titulo2");
        if (elAgendamentos) elAgendamentos.textContent = agendamentosResp.count ?? 0;
    }

    if (pontuacaoResp.error) {
        console.error("Erro ao buscar pontuação:", pontuacaoResp.error);
    } else {
        const elPontuacao = document.querySelector(".card.pontuacao .titulo2");
        if (elPontuacao) elPontuacao.textContent = pontuacaoResp.data?.pontuacao_total ?? 0;
    }
}
