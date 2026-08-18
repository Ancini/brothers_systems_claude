import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

// Nome do bucket no Supabase Storage — segue a mesma grafia (sem o "e") do
// resto do banco, e foi criado com "E" maiúsculo (nomes de bucket são case-sensitive).
const BUCKET_FOTOS = "Estabelicimentos";

function preencherNomeAdmin() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("admin-nome");
    if (!usuario || !elNome) return;

    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Administrador";
    elNome.textContent = nomeCompleto;
}

function configurarPreviewFoto() {
    const input = document.getElementById("foto-estabelecimento");
    const texto = document.getElementById("texto-foto");

    input.addEventListener("change", () => {
        const arquivo = input.files[0];
        texto.textContent = arquivo ? arquivo.name : "Anexe foto do estabelecimento";
    });
}

// Sobe a foto pro Storage (bucket "estabelecimentos") e devolve a URL pública.
// Se não tiver arquivo selecionado, devolve null (o campo imagem_estab fica vazio).
async function enviarFoto() {
    const input = document.getElementById("foto-estabelecimento");
    const arquivo = input.files[0];
    if (!arquivo) return null;

    const extensao = arquivo.name.split(".").pop();
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

    const { error: erroUpload } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(nomeArquivo, arquivo, { cacheControl: "3600", upsert: false });

    if (erroUpload) throw erroUpload;

    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(nomeArquivo);
    return data.publicUrl;
}

async function cadastrarEstabelecimento(event) {
    event.preventDefault();

    const nome = document.getElementById("nome-estabelecimento").value.trim();
    const ramo = document.getElementById("ramo-estabelecimento").value.trim();
    const cidade = document.getElementById("cidade-estabelecimento").value.trim();
    const estado = document.getElementById("estado-estabelecimento").value;
    const abertura = document.getElementById("horario-abertura").value;
    const fechamento = document.getElementById("horario-fechamento").value;

    if (!nome || !ramo || !cidade || !estado || !abertura || !fechamento) {
        alert("Preencha todos os campos antes de confirmar o cadastro.");
        return;
    }

    const btnConfirmar = document.getElementById("btn-confirmar");
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Cadastrando...";

    try {
        const urlFoto = await enviarFoto();

        const { error } = await supabase.from("estabelicimento").insert({
            nome_estabelicimento: nome,
            ramo_estabelicimento: ramo,
            cidade_estabelicimento: cidade,
            estado_estabelicimento: estado,
            horario_abertura: abertura,
            horario_fechamento: fechamento,
            imagem_estab: urlFoto
        });

        if (error) throw error;

        alert("Estabelecimento cadastrado com sucesso!");
        window.location.href = "menu_administrador.html";
    } catch (erro) {
        console.error("Erro ao cadastrar estabelecimento:", erro);
        alert(erro.message || "Erro ao cadastrar o estabelecimento.");
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = 'Confirmar Cadastro <i class="fa-solid fa-check"></i>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();
    configurarPreviewFoto();

    document.getElementById("form-estabelecimento").addEventListener("submit", cadastrarEstabelecimento);
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_administrador.html";
    });
});
