import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

function preencherNomeAdmin() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("admin-nome");
    if (!usuario || !elNome) return;

    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Administrador";
    elNome.textContent = nomeCompleto;
}

async function cadastrarServico(event) {
    event.preventDefault();

    const nome = document.getElementById("nome-servico").value.trim();
    const pontuacao = Number(document.getElementById("pontuacao-servico").value);

    if (!nome || !pontuacao || pontuacao < 1) {
        alert("Preencha o nome e uma pontuação válida (maior que zero) pro serviço.");
        return;
    }

    try {
        const { error } = await supabase
            .from("servico")
            .insert({ nome_servico: nome, pontuacao_servico: pontuacao });

        if (error) throw error;

        alert("Serviço cadastrado com sucesso!");
        window.location.href = "menu_administrador.html";
    } catch (erro) {
        console.error("Erro ao cadastrar serviço:", erro);
        alert(erro.message || "Erro ao cadastrar o serviço.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();

    document.getElementById("form-servico").addEventListener("submit", cadastrarServico);
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_administrador.html";
    });
});
