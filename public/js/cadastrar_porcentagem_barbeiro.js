import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

function preencherNomeDono() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("dono-nome");
    if (!elNome) return;

    const nomeCompleto = usuario?.nome || usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Proprietário";
    elNome.textContent = nomeCompleto;
}

// Acha o id_prestador do dono logado (mesmo padrão de controle_barbeiro.js:
// prestador.uuid_vinculo == auth.uid()). Qualquer uma das linhas dele serve,
// já que id_prestador é sempre o mesmo usuario.id_usuario em todas as lojas.
async function identificarPrestadorLogado() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("prestador")
        .select("id_prestador")
        .eq("uuid_vinculo", user.id)
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].id_prestador;
}

// Lojas onde esse prestador está marcado como dono — coluna `proprietario_estab`
// (bool) na própria tabela `prestador`, na linha barbeiro↔loja correspondente
// (mesma verificação usada em js/outras_funcionalidades.js).
async function buscarEstabelecimentosDoDono(idPrestador) {
    const { data, error } = await supabase
        .from("prestador")
        .select("id_estabelicimento")
        .eq("id_prestador", idPrestador)
        .eq("proprietario_estab", true);

    if (error) {
        console.error("Não foi possível verificar os estabelecimentos do dono:", error);
        return [];
    }

    return (data || []).map(linha => linha.id_estabelicimento);
}

// Só os funcionários (prestadores) das lojas que esse dono realmente tem —
// nunca a base toda de barbeiros do sistema. Exclui o próprio dono da lista.
async function carregarFuncionarios(idPrestadorLogado, idsEstabelecimentos) {
    const select = document.getElementById("barbeiro-select");

    if (!idsEstabelecimentos || idsEstabelecimentos.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.disabled = true;
        option.textContent = "Nenhum estabelecimento encontrado pra esse dono";
        select.appendChild(option);
        return;
    }

    const { data, error } = await supabase
        .from("prestador")
        .select("id_prestador, usuario:prestador_id_prestador_fkey ( nome_usuario )")
        .in("id_estabelicimento", idsEstabelecimentos)
        .neq("id_prestador", idPrestadorLogado);

    if (error) {
        console.error("Erro ao buscar funcionários do estabelecimento:", error);
        return;
    }

    // Um mesmo funcionário pode ter uma linha por loja — remove duplicatas
    // caso o dono tenha mais de um estabelecimento com o mesmo barbeiro.
    const funcionarios = new Map();
    (data || []).forEach(linha => {
        if (linha.usuario?.nome_usuario) {
            funcionarios.set(linha.id_prestador, linha.usuario.nome_usuario);
        }
    });

    Array.from(funcionarios.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([idPrestador, nome]) => {
            const option = document.createElement("option");
            option.value = idPrestador;
            option.textContent = nome;
            select.appendChild(option);
        });
}

// Máscara de porcentagem: digita só números, formata como "XX%" em tempo real,
// limitado a 100.
function aplicarMascaraPorcentagem(input) {
    input.addEventListener("input", () => {
        const digitos = input.value.replace(/\D/g, "").slice(0, 3);
        if (!digitos) {
            input.value = "";
            return;
        }
        const valor = Math.min(100, Number(digitos));
        input.value = `${valor}%`;
    });
}

function porcentagemMascaradaParaNumero(valorFormatado) {
    const digitos = valorFormatado.replace(/\D/g, "");
    return digitos ? Number(digitos) : 0;
}

// A tabela/coluna de comissão ainda não existe no banco (ver memória do
// projeto) — por enquanto só valida o formulário; o cadastro em si fica
// pendente até o back-end estar pronto.
function confirmarCadastro(event) {
    event.preventDefault();

    const idBarbeiro = Number(document.getElementById("barbeiro-select").value);
    const porcentagem = porcentagemMascaradaParaNumero(document.getElementById("porcentagem-barbeiro").value);

    if (!idBarbeiro || !porcentagem) {
        alert("Selecione o barbeiro e informe a porcentagem antes de confirmar.");
        return;
    }

    alert("Essa tela ainda está sem back-end — o cadastro da porcentagem será habilitado em breve.");
}

document.addEventListener("DOMContentLoaded", async () => {
    preencherNomeDono();
    aplicarMascaraPorcentagem(document.getElementById("porcentagem-barbeiro"));

    const idPrestadorLogado = await identificarPrestadorLogado();
    if (idPrestadorLogado) {
        const idsEstabelecimentos = await buscarEstabelecimentosDoDono(idPrestadorLogado);
        await carregarFuncionarios(idPrestadorLogado, idsEstabelecimentos);
    } else {
        console.error("Não foi possível identificar o dono logado. Verifique o login ou o vínculo no banco.");
    }

    document.getElementById("form-porcentagem").addEventListener("submit", confirmarCadastro);
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_inicial_barbeiro.html";
    });
});
