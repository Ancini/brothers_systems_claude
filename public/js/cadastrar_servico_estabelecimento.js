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

async function carregarServicos() {
    const select = document.getElementById("servico-select");

    const { data, error } = await supabase
        .from("servico")
        .select("id_servico, nome_servico")
        .order("nome_servico");

    if (error) {
        console.error("Erro ao buscar serviços:", error);
        return;
    }

    data.forEach(servico => {
        const option = document.createElement("option");
        option.value = servico.id_servico;
        option.textContent = servico.nome_servico;
        select.appendChild(option);
    });
}

// Máscara de dinheiro: digita só números, formata como "R$ 12,34" em tempo real
// (os dígitos digitados são sempre os centavos, como em caixa eletrônico)
function aplicarMascaraMoeda(input) {
    input.addEventListener("input", () => {
        const digitos = input.value.replace(/\D/g, "");
        if (!digitos) {
            input.value = "";
            return;
        }
        const valor = Number(digitos) / 100;
        input.value = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    });
}

function valorMascaradoParaNumero(valorFormatado) {
    const digitos = valorFormatado.replace(/\D/g, "");
    return digitos ? Number(digitos) / 100 : 0;
}

// Máscara de tempo: digita só números, formata como "45 min" em tempo real
function aplicarMascaraTempo(input) {
    input.addEventListener("input", () => {
        const digitos = input.value.replace(/\D/g, "").slice(0, 3);
        input.value = digitos ? `${digitos} min` : "";
    });
}

function tempoMascaradoParaNumero(tempoFormatado) {
    const digitos = tempoFormatado.replace(/\D/g, "");
    return digitos ? Number(digitos) : 0;
}

async function cadastrarServicoEstabelecimento(event) {
    event.preventDefault();

    const idEstabelecimento = Number(document.getElementById("estabelecimento-select").value);
    const idServico = Number(document.getElementById("servico-select").value);
    const valor = valorMascaradoParaNumero(document.getElementById("valor-servico").value);
    const tempo = tempoMascaradoParaNumero(document.getElementById("tempo-servico").value);

    if (!idEstabelecimento || !idServico || !valor || !tempo) {
        alert("Preencha todos os campos antes de confirmar o cadastro.");
        return;
    }

    try {
        const { error } = await supabase.from("servico_estabelicimento").insert({
            id_estabelicimento: idEstabelecimento,
            id_servico: idServico,
            valor_servico: valor,
            tempo_servico: tempo
        });

        if (error) throw error;

        alert("Serviço vinculado ao estabelecimento com sucesso!");
        window.location.href = "menu_administrador.html";
    } catch (erro) {
        console.error("Erro ao cadastrar serviço do estabelecimento:", erro);
        alert(erro.message || "Erro ao cadastrar o serviço para o estabelecimento.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();
    carregarEstabelecimentos();
    carregarServicos();
    aplicarMascaraMoeda(document.getElementById("valor-servico"));
    aplicarMascaraTempo(document.getElementById("tempo-servico"));

    document.getElementById("form-servico-estabelecimento").addEventListener("submit", cadastrarServicoEstabelecimento);
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_administrador.html";
    });
});
