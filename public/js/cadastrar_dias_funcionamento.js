import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

// dia_semana segue o mesmo padrão do Date.getDay() usado no resto do app
// (0 = domingo ... 6 = sábado), mas a lista é exibida começando na segunda,
// como no protótipo.
const DIAS = [
    { dia_semana: 1, nome: "Segunda-feira" },
    { dia_semana: 2, nome: "Terça-feira" },
    { dia_semana: 3, nome: "Quarta-feira" },
    { dia_semana: 4, nome: "Quinta-feira" },
    { dia_semana: 5, nome: "Sexta-feira" },
    { dia_semana: 6, nome: "Sábado" },
    { dia_semana: 0, nome: "Domingo" }
];

// Usado só quando a barbearia ainda não tem nenhuma linha salva em
// horario_funcionamento (primeira vez configurando): domingo vem fechado,
// os demais dias vêm abertos 08:00-18:00 como sugestão de ponto de partida.
const ABERTO_PADRAO = (dia_semana) => dia_semana !== 0;

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

    (data || []).forEach(estabelecimento => {
        const option = document.createElement("option");
        option.value = estabelecimento.id_estabelicimento;
        option.textContent = estabelecimento.nome_estabelicimento;
        select.appendChild(option);
    });
}

function alternarLinhaDia(linha, aberto) {
    const horarios = linha.querySelector(".dia-horarios");
    const fechado = linha.querySelector(".dia-fechado");
    // Usa style.display (não o atributo hidden) porque .dia-horarios já tem
    // "display: flex" fixado no CSS — isso sobrescreveria o "[hidden]{display:none}"
    // do navegador e os dois ficariam visíveis ao mesmo tempo.
    horarios.style.display = aberto ? "flex" : "none";
    fechado.style.display = aberto ? "none" : "block";
}

// "08:00:00" (como vem do banco) -> "08:00" (o que <input type="time"> aceita)
function paraHoraCurta(horaTexto) {
    return (horaTexto || "08:00").slice(0, 5);
}

function preencherLinha(linha, { aberto, horario_abertura, horario_fechamento }) {
    linha.querySelector(".dia-checkbox").checked = aberto;
    if (horario_abertura) linha.querySelector(".horario-abertura").value = paraHoraCurta(horario_abertura);
    if (horario_fechamento) linha.querySelector(".horario-fechamento").value = paraHoraCurta(horario_fechamento);
    alternarLinhaDia(linha, aberto);
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
                <span class="dia-nome">${nome}</span>
                <input type="checkbox" class="dia-checkbox">
            </div>
            <div class="dia-horarios">
                <input type="time" class="horario-pill horario-abertura" value="08:00">
                <i class="fa-solid fa-clock horario-icone"></i>
                <input type="time" class="horario-pill horario-fechamento" value="18:00">
            </div>
            <div class="dia-fechado">fechado</div>
        `;

        preencherLinha(linha, { aberto: ABERTO_PADRAO(dia_semana), horario_abertura: "08:00", horario_fechamento: "18:00" });

        linha.querySelector(".dia-checkbox").addEventListener("change", (event) => {
            alternarLinhaDia(linha, event.target.checked);
        });

        container.appendChild(linha);
    });
}

// Busca o que já está salvo pra essa barbearia em horario_funcionamento e
// preenche a tela com isso. Se ainda não tiver nada salvo, volta pro padrão.
async function carregarConfiguracaoSalva(idEstabelecimento) {
    const { data, error } = await supabase
        .from("horario_funcionamento")
        .select("dia_semana, aberto, horario_abertura, horario_fechamento")
        .eq("id_estabelicimento", idEstabelecimento);

    if (error) {
        console.error("Erro ao buscar horario_funcionamento:", error);
        alert("Não foi possível carregar os dias já configurados dessa barbearia.");
        return;
    }

    const porDia = new Map((data || []).map(linha => [linha.dia_semana, linha]));

    document.querySelectorAll(".dia-linha").forEach(linha => {
        const dia_semana = Number(linha.dataset.diaSemana);
        const salvo = porDia.get(dia_semana);

        if (salvo) {
            preencherLinha(linha, salvo);
        } else {
            preencherLinha(linha, { aberto: ABERTO_PADRAO(dia_semana), horario_abertura: "08:00", horario_fechamento: "18:00" });
        }
    });
}

async function salvarConfiguracao() {
    const select = document.getElementById("estabelecimento-select");
    const idEstabelecimento = Number(select.value);

    if (!idEstabelecimento) {
        alert("Selecione o estabelecimento antes de salvar.");
        return;
    }

    const linhas = [...document.querySelectorAll(".dia-linha")].map(linha => {
        const dia_semana = Number(linha.dataset.diaSemana);
        const aberto = linha.querySelector(".dia-checkbox").checked;

        return {
            id_estabelicimento: idEstabelecimento,
            dia_semana,
            aberto,
            horario_abertura: aberto ? `${linha.querySelector(".horario-abertura").value}:00` : null,
            horario_fechamento: aberto ? `${linha.querySelector(".horario-fechamento").value}:00` : null
        };
    });

    const btnSalvar = document.getElementById("btn-salvar");
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";
    }

    const { error } = await supabase
        .from("horario_funcionamento")
        .upsert(linhas, { onConflict: "id_estabelicimento,dia_semana" });

    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar dias de abertura';
    }

    if (error) {
        console.error("Erro ao salvar horario_funcionamento:", error);
        alert(error.message || "Erro ao salvar os dias de abertura.");
        return;
    }

    alert("Dias de abertura salvos com sucesso!");
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();
    carregarEstabelecimentos();
    montarListaDias();

    document.getElementById("estabelecimento-select").addEventListener("change", (event) => {
        const idEstabelecimento = Number(event.target.value);
        if (idEstabelecimento) carregarConfiguracaoSalva(idEstabelecimento);
    });

    document.getElementById("btn-salvar").addEventListener("click", salvarConfiguracao);
});
