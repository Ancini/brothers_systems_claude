import { supabase } from "./supabase.js";

// Mesma ordem/rotulagem usada em cadastrar_dias_funcionamento.js e cadastrar_promocao.js
// (dia_semana segue Date.getDay(): 0=domingo...6=sábado, lista exibida começando na segunda).
const DIAS = [
    { dia_semana: 1, nome: "Segunda-feira" },
    { dia_semana: 2, nome: "Terça-feira" },
    { dia_semana: 3, nome: "Quarta-feira" },
    { dia_semana: 4, nome: "Quinta-feira" },
    { dia_semana: 5, nome: "Sexta-feira" },
    { dia_semana: 6, nome: "Sábado" },
    { dia_semana: 0, nome: "Domingo" }
];

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Mapa dia_semana -> Date da semana atual (a que contém hoje) — mesma função
// usada em cadastrar_promocao.js pra "só vale essa semana".
function montarDatasDaSemana() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diaAtual = hoje.getDay();
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

async function carregarIdentidadeBarbeiro() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Você precisa estar logado como barbeiro.");
        window.location.href = "index.html";
        return null;
    }

    const { data: vinculo, error } = await supabase
        .from("prestador")
        .select("id_prestador, usuario:prestador_id_prestador_fkey ( nome_usuario )")
        .eq("uuid_vinculo", user.id)
        .limit(1);

    if (error || !vinculo || vinculo.length === 0) {
        console.error("Erro ao identificar o barbeiro:", error);
        alert("Não foi possível identificar você como barbeiro. Fale com o administrador.");
        return null;
    }

    const elNome = document.getElementById("barbeiro-nome");
    if (elNome && vinculo[0].usuario?.nome_usuario) {
        elNome.textContent = vinculo[0].usuario.nome_usuario;
    }

    return vinculo[0].id_prestador;
}

function alternarLinhaDia(linha, bloqueado) {
    linha.querySelector(".dia-bloqueio").style.display = bloqueado ? "flex" : "none";
}

function paraHoraCurta(horaTexto) {
    return (horaTexto || "08:00").slice(0, 5);
}

function montarListaDias() {
    const container = document.getElementById("dias-lista");
    container.innerHTML = "";

    DIAS.forEach(({ dia_semana, nome }) => {
        const linha = document.createElement("div");
        linha.className = "dia-linha";
        linha.dataset.diaSemana = dia_semana;
        linha.innerHTML = `
            <div class="dia-cabecalho">
                <input type="checkbox" class="dia-checkbox">
                <span class="dia-nome">${nome}</span>
            </div>
            <div class="dia-bloqueio">
                <input type="time" class="horario-pill horario-inicio" value="08:00">
                <i class="horario-icone">às</i>
                <input type="time" class="horario-pill horario-fim" value="09:00">
                <button type="button" class="btn-excluir-bloqueio" title="Excluir bloqueio">
                    <img src="css/imagens/lixeira.png" alt="Excluir">
                </button>
            </div>
        `;

        const checkbox = linha.querySelector(".dia-checkbox");
        checkbox.addEventListener("change", () => alternarLinhaDia(linha, checkbox.checked));

        // Desmarca e esconde — a remoção de verdade no banco só acontece ao confirmar,
        // mesmo critério já usado em cadastrar_promocao.js pros dias desmarcados.
        linha.querySelector(".btn-excluir-bloqueio").addEventListener("click", () => {
            checkbox.checked = false;
            alternarLinhaDia(linha, false);
        });

        container.appendChild(linha);
    });
}

async function carregarBloqueiosDaSemana(idPrestador, datasDaSemana) {
    const datasOrdenadas = [...datasDaSemana.values()].sort((a, b) => a - b);
    const inicio = formatarDataBanco(datasOrdenadas[0]);
    const fim = formatarDataBanco(datasOrdenadas[datasOrdenadas.length - 1]);

    const { data, error } = await supabase
        .from("bloqueio_agenda")
        .select("data, horario_inicio, horario_fim")
        .eq("id_prestador", idPrestador)
        .gte("data", inicio)
        .lte("data", fim);

    if (error) {
        console.error("Erro ao buscar bloqueios da semana:", error);
        return;
    }

    if (!data || data.length === 0) return;

    const dataParaDiaSemana = new Map(
        [...datasDaSemana.entries()].map(([diaSemana, data]) => [formatarDataBanco(data), diaSemana])
    );

    data.forEach(linhaSalva => {
        const diaSemana = dataParaDiaSemana.get(linhaSalva.data);
        if (diaSemana === undefined) return;

        const linha = document.querySelector(`.dia-linha[data-dia-semana="${diaSemana}"]`);
        if (!linha) return;

        linha.querySelector(".dia-checkbox").checked = true;
        linha.querySelector(".horario-inicio").value = paraHoraCurta(linhaSalva.horario_inicio);
        linha.querySelector(".horario-fim").value = paraHoraCurta(linhaSalva.horario_fim);
        alternarLinhaDia(linha, true);
    });
}

async function confirmarBloqueios(idPrestador, datasDaSemana) {
    const linhas = [...document.querySelectorAll(".dia-linha")];

    const marcadas = linhas.filter(linha => linha.querySelector(".dia-checkbox").checked);
    const desmarcadas = linhas.filter(linha => {
        const checkbox = linha.querySelector(".dia-checkbox");
        return !checkbox.checked && checkbox.dataset.jaTinhaBloqueio === "true";
    });

    for (const linha of marcadas) {
        const inicio = linha.querySelector(".horario-inicio").value;
        const fim = linha.querySelector(".horario-fim").value;
        if (!inicio || !fim || inicio >= fim) {
            alert(`Confira o horário de "${linha.querySelector(".dia-nome").textContent}": o fim precisa ser depois do início.`);
            return;
        }
    }

    const datasParaSalvar = marcadas.map(linha => {
        const dia_semana = Number(linha.dataset.diaSemana);
        return {
            id_prestador: idPrestador,
            data: formatarDataBanco(datasDaSemana.get(dia_semana)),
            horario_inicio: `${linha.querySelector(".horario-inicio").value}:00`,
            horario_fim: `${linha.querySelector(".horario-fim").value}:00`
        };
    });

    const datasParaRemover = desmarcadas.map(linha => {
        const dia_semana = Number(linha.dataset.diaSemana);
        return formatarDataBanco(datasDaSemana.get(dia_semana));
    });

    const btnConfirmar = document.getElementById("btn-confirmar");
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Salvando...";

    try {
        if (datasParaRemover.length > 0) {
            const { error: erroRemover } = await supabase
                .from("bloqueio_agenda")
                .delete()
                .eq("id_prestador", idPrestador)
                .in("data", datasParaRemover);

            if (erroRemover) throw erroRemover;
        }

        if (datasParaSalvar.length > 0) {
            const { error: erroSalvar } = await supabase
                .from("bloqueio_agenda")
                .upsert(datasParaSalvar, { onConflict: "id_prestador,data" });

            if (erroSalvar) throw erroSalvar;
        }

        alert("Agenda atualizada com sucesso!");
        window.location.href = "menu_inicial_barbeiro.html";
    } catch (erro) {
        console.error("Erro ao salvar bloqueios da agenda:", erro);
        alert(erro.message || "Erro ao salvar. Tente novamente.");
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "Confirmar";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    montarListaDias();

    const idPrestador = await carregarIdentidadeBarbeiro();
    if (!idPrestador) return;

    const datasDaSemana = montarDatasDaSemana();
    await carregarBloqueiosDaSemana(idPrestador, datasDaSemana);

    // Marca quais dias já tinham bloqueio salvo antes de qualquer clique do
    // usuário — usado na hora de confirmar pra saber quais remover do banco.
    document.querySelectorAll(".dia-checkbox").forEach(checkbox => {
        checkbox.dataset.jaTinhaBloqueio = checkbox.checked ? "true" : "false";
    });

    document.getElementById("btn-confirmar").addEventListener("click", () => {
        confirmarBloqueios(idPrestador, datasDaSemana);
    });

    document.getElementById("btn-voltar").addEventListener("click", () => {
        window.location.href = "menu_inicial_barbeiro.html";
    });
});
