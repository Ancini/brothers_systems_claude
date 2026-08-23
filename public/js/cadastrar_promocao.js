import { supabase } from "./supabase.js";

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Mapa dia_semana (0=domingo...6=sábado) -> Date daquela semana (a que contém hoje).
// É isso que resolve "marcou Domingo" pra uma data concreta ("aquela semana").
function montarDatasDaSemana() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diaAtual = hoje.getDay(); // 0=domingo...6=sábado
    const diasDesdeSegunda = diaAtual === 0 ? 6 : diaAtual - 1;
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() - diasDesdeSegunda);

    const mapa = new Map();
    for (let i = 0; i < 7; i++) {
        const data = new Date(segunda);
        data.setDate(segunda.getDate() + i);
        mapa.set(data.getDay(), data);
    }
    return mapa;
}

// Descobre o barbeiro logado e o estabelecimento dele (mesmo caminho usado em
// public/js/controle_barbeiro.js), e preenche o nome no cabeçalho.
async function carregarIdentidadeBarbeiro() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Você precisa estar logado como barbeiro.");
        window.location.href = "index.html";
        return null;
    }

    const { data: vinculo, error } = await supabase
        .from("prestador")
        .select("id_estabelicimento, usuario:prestador_id_prestador_fkey ( nome_usuario )")
        .eq("uuid_vinculo", user.id)
        .limit(1);

    if (error || !vinculo || vinculo.length === 0) {
        console.error("Erro ao identificar o barbeiro:", error);
        alert("Não foi possível identificar sua barbearia. Fale com o administrador.");
        return null;
    }

    const elNome = document.getElementById("barbeiro-nome");
    if (elNome && vinculo[0].usuario?.nome_usuario) {
        elNome.textContent = vinculo[0].usuario.nome_usuario;
    }

    return vinculo[0].id_estabelicimento;
}

// Carrega as promoções já cadastradas pra essa barbearia dentro da semana atual
// e marca os checkboxes/rádio de acordo, pra o barbeiro ver o que já está ativo.
async function carregarPromocoesDaSemana(idEstabelecimento, datasDaSemana) {
    const inicio = formatarDataBanco([...datasDaSemana.values()][0]);
    const fim = formatarDataBanco([...datasDaSemana.values()][6]);

    const { data, error } = await supabase
        .from("promocao")
        .select("data_promocao, percentual_desconto")
        .eq("id_estabelicimento", idEstabelecimento)
        .gte("data_promocao", inicio)
        .lte("data_promocao", fim);

    if (error) {
        console.error("Erro ao buscar promoções da semana:", error);
        return;
    }

    if (!data || data.length === 0) return;

    // Reconstrói qual dia_semana cada data salva representa, comparando com o
    // mapa da semana atual.
    const dataParaDiaSemana = new Map(
        [...datasDaSemana.entries()].map(([diaSemana, data]) => [formatarDataBanco(data), diaSemana])
    );

    data.forEach(linha => {
        const diaSemana = dataParaDiaSemana.get(linha.data_promocao);
        if (diaSemana === undefined) return;

        const checkbox = document.querySelector(`.dia-checkbox[value="${diaSemana}"]`);
        if (checkbox) checkbox.checked = true;

        const radio = document.querySelector(`input[name="desconto"][value="${linha.percentual_desconto}"]`);
        if (radio) radio.checked = true;
    });
}

async function confirmarPromocao(idEstabelecimento, datasDaSemana) {
    const diasMarcados = [...document.querySelectorAll(".dia-checkbox:checked")]
        .map(checkbox => Number(checkbox.value));

    if (diasMarcados.length === 0) {
        alert("Marque pelo menos um dia da semana.");
        return;
    }

    const percentualSelecionado = document.querySelector('input[name="desconto"]:checked');
    if (!percentualSelecionado) {
        alert("Selecione um percentual de desconto.");
        return;
    }

    const percentual = Number(percentualSelecionado.value);

    const datasParaSalvar = diasMarcados.map(diaSemana => formatarDataBanco(datasDaSemana.get(diaSemana)));

    // Dias que tinham promoção salva antes e foram desmarcados agora — remove.
    const todosOsDiasSemana = [0, 1, 2, 3, 4, 5, 6];
    const diasDesmarcados = todosOsDiasSemana.filter(diaSemana => {
        const checkbox = document.querySelector(`.dia-checkbox[value="${diaSemana}"]`);
        return checkbox && !checkbox.checked && checkbox.dataset.jaTinhaPromocao === "true";
    });
    const datasParaRemover = diasDesmarcados.map(diaSemana => formatarDataBanco(datasDaSemana.get(diaSemana)));

    const btnConfirmar = document.getElementById("btn-confirmar");
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Salvando...";

    try {
        if (datasParaRemover.length > 0) {
            const { error: erroRemover } = await supabase
                .from("promocao")
                .delete()
                .eq("id_estabelicimento", idEstabelecimento)
                .in("data_promocao", datasParaRemover);

            if (erroRemover) throw erroRemover;
        }

        const linhas = datasParaSalvar.map(data => ({
            id_estabelicimento: idEstabelecimento,
            data_promocao: data,
            percentual_desconto: percentual
        }));

        const { error: erroSalvar } = await supabase
            .from("promocao")
            .upsert(linhas, { onConflict: "id_estabelicimento,data_promocao" });

        if (erroSalvar) throw erroSalvar;

        alert("Promoção salva com sucesso!");
        window.location.href = "menu_inicial_barbeiro.html";
    } catch (erro) {
        console.error("Erro ao salvar promoção:", erro);
        alert(erro.message || "Erro ao salvar a promoção.");
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = 'Confirmar <i class="fa-solid fa-check"></i>';
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const idEstabelecimento = await carregarIdentidadeBarbeiro();
    if (!idEstabelecimento) return;

    const datasDaSemana = montarDatasDaSemana();
    await carregarPromocoesDaSemana(idEstabelecimento, datasDaSemana);

    // Marca quais dias já tinham promoção antes de qualquer clique do usuário —
    // usado na hora de salvar pra saber quais desmarcar (remover) do banco.
    document.querySelectorAll(".dia-checkbox").forEach(checkbox => {
        checkbox.dataset.jaTinhaPromocao = checkbox.checked ? "true" : "false";
    });

    document.getElementById("btn-confirmar").addEventListener("click", () => {
        confirmarPromocao(idEstabelecimento, datasDaSemana);
    });

    document.getElementById("btn-cancelar").addEventListener("click", () => {
        window.location.href = "menu_inicial_barbeiro.html";
    });
});
