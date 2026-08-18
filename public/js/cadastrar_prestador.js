import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

function preencherNomeAdmin() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("admin-nome");
    if (!usuario || !elNome) return;

    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Administrador";
    elNome.textContent = nomeCompleto;
}

async function carregarEstabelecimentos() {
    const select = document.getElementById("estabelecimento-select");

    const { data, error } = await supabase
        .from("estabelicimento")
        .select("id_estabelicimento, nome_estabelicimento")
        .order("nome_estabelicimento");

    if (error) {
        console.error("Erro ao buscar estabelecimentos:", error);
        return;
    }

    data.forEach(estabelecimento => {
        const option = document.createElement("option");
        option.value = estabelecimento.id_estabelicimento;
        option.textContent = estabelecimento.nome_estabelicimento;
        select.appendChild(option);
    });
}

// Só barbeiros (usuario.barbeiro = true) podem virar prestador de um estabelecimento
async function carregarPrestadores() {
    const select = document.getElementById("prestador-select");

    const { data, error } = await supabase
        .from("usuario")
        .select("id_usuario, nome_usuario, auth_id")
        .eq("barbeiro", true)
        .order("nome_usuario");

    if (error) {
        console.error("Erro ao buscar barbeiros:", error);
        return;
    }

    data.forEach(usuario => {
        const option = document.createElement("option");
        option.value = usuario.id_usuario;
        option.dataset.authId = usuario.auth_id;
        option.textContent = usuario.nome_usuario;
        select.appendChild(option);
    });
}

async function cadastrarPrestador(event) {
    event.preventDefault();

    const selectEstabelecimento = document.getElementById("estabelecimento-select");
    const selectPrestador = document.getElementById("prestador-select");

    const idEstabelecimento = Number(selectEstabelecimento.value);
    const idPrestador = Number(selectPrestador.value);
    const opcaoPrestador = selectPrestador.selectedOptions[0];
    const uuidVinculo = opcaoPrestador ? opcaoPrestador.dataset.authId : null;

    if (!idEstabelecimento || !idPrestador) {
        alert("Selecione o estabelecimento e o prestador antes de confirmar o cadastro.");
        return;
    }

    try {
        const { error } = await supabase.from("prestador").insert({
            id_estabelicimento: idEstabelecimento,
            id_prestador: idPrestador,
            uuid_vinculo: uuidVinculo
        });

        if (error) throw error;

        alert("Prestador cadastrado com sucesso!");
        window.location.href = "menu_administrador.html";
    } catch (erro) {
        console.error("Erro ao cadastrar prestador:", erro);
        alert(erro.message || "Erro ao cadastrar o prestador.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();
    carregarEstabelecimentos();
    carregarPrestadores();

    document.getElementById("form-prestador").addEventListener("submit", cadastrarPrestador);
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_administrador.html";
    });
});
