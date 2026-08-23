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

// Ainda sem tabela no banco pra isso (ver conversa sobre horario_funcionamento) —
// por enquanto só o comportamento visual: nenhuma barbearia abre aos domingos,
// as demais vêm marcadas como abertas com um horário padrão.
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

function montarListaDias() {
    const container = document.getElementById("dias-lista");
    container.innerHTML = "";

    DIAS.forEach(({ dia_semana, nome }) => {
        const aberto = ABERTO_PADRAO(dia_semana);

        const linha = document.createElement("div");
        linha.className = "dia-linha";
        linha.dataset.diaSemana = dia_semana;
        linha.innerHTML = `
            <div class="dia-cabecalho">
                <span class="dia-nome">${nome}</span>
                <input type="checkbox" class="dia-checkbox" ${aberto ? "checked" : ""}>
            </div>
            <div class="dia-horarios">
                <input type="time" class="horario-pill horario-abertura" value="08:00">
                <i class="fa-solid fa-clock horario-icone"></i>
                <input type="time" class="horario-pill horario-fechamento" value="18:00">
            </div>
            <div class="dia-fechado">fechado</div>
        `;

        alternarLinhaDia(linha, aberto);

        linha.querySelector(".dia-checkbox").addEventListener("change", (event) => {
            alternarLinhaDia(linha, event.target.checked);
        });

        container.appendChild(linha);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    preencherNomeAdmin();
    carregarEstabelecimentos();
    montarListaDias();
});
