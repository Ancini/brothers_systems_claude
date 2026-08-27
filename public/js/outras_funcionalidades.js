import { pegarSessao } from "./session.js";
import { supabase } from "./supabase.js";

async function identificarPrestadorLogado() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('prestador')
        .select('id_prestador')
        .eq('uuid_vinculo', user.id)
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].id_prestador;
}

// Mostra o atalho pro painel do administrador só se a sessão salva
// (localStorage, ver public/js/session.js) tiver administrador = true.
function exibirCardPainelAdministrativo(usuario) {
    const ehAdministrador = usuario?.administrador === true || usuario?.administrador === "true";
    if (!ehAdministrador) return;

    const card = document.getElementById("cardPainelAdministrativo");
    if (!card) return;

    card.style.display = "flex";
    card.addEventListener("click", () => {
        window.location.href = "menu_administrador.html";
    });
}

// Mostra o atalho pro relatório por funcionário para: (1) administrador, sempre
// — pra poder acompanhar/testar a tela mesmo sem ser dono de nenhum
// estabelecimento; ou (2) prestador cadastrado como dono do estabelecimento na
// tabela `proprietario_estabelecimento` (id_prestador, id_estabelicimento) —
// tabela/nomes ainda a confirmar quando a tela de "cadastrar proprietário" for
// criada; ajustar aqui se mudar.
async function exibirCardRelatorioFuncionarios(usuario, idPrestador) {
    const ehAdministrador = usuario?.administrador === true || usuario?.administrador === "true";

    if (!ehAdministrador) {
        if (!idPrestador) return;

        try {
            const { data, error } = await supabase
                .from('proprietario_estabelecimento')
                .select('id_prestador')
                .eq('id_prestador', idPrestador)
                .limit(1);

            if (error) throw error;
            if (!data || data.length === 0) return;
        } catch (error) {
            console.error("Não foi possível verificar se o prestador é dono do estabelecimento:", error);
            return;
        }
    }

    const card = document.getElementById("cardRelatorioFuncionarios");
    if (!card) return;

    card.style.display = "flex";
    card.addEventListener("click", () => {
        window.location.href = "relatorio_funcionarios.html";
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const usuario = pegarSessao();

    exibirCardPainelAdministrativo(usuario);

    const idPrestador = await identificarPrestadorLogado();
    exibirCardRelatorioFuncionarios(usuario, idPrestador);
});
