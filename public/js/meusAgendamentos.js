import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatarHorario12h(horario24) {
    if (!horario24) return { hora: "--:--", periodo: "" };
    const [horaStr, minutoStr] = horario24.split(":");
    let hora = parseInt(horaStr, 10);
    const periodo = hora >= 12 ? "PM" : "AM";
    hora = hora % 12;
    if (hora === 0) hora = 12;
    return { hora: `${String(hora).padStart(2, "0")}:${minutoStr}`, periodo };
}

function formatarData(dataTexto) {
    if (!dataTexto) return { data: "-", diaSemana: "" };
    const [ano, mes, dia] = dataTexto.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    return {
        data: `${dia} de ${MESES[mes - 1]} de ${ano}`,
        diaSemana: DIAS_SEMANA[data.getDay()]
    };
}

function exibirNomeCliente(usuario) {
    const elNome = document.querySelector(".cliente-info .nome");
    if (!elNome) return;
    const nomeCompleto = usuario.nome || usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";
    elNome.textContent = nomeCompleto.split(" ")[0];
}

function renderizarAgendamentos(agendamentos) {
    const container = document.querySelector(".agendamentos-lista");
    const elTotal = document.querySelector(".agendamentos-total");
    if (elTotal) elTotal.textContent = agendamentos.length;
    if (!container) return;

    container.innerHTML = "";

    if (agendamentos.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Você ainda não tem agendamentos.</p>`;
        return;
    }

    agendamentos.forEach(ag => {
        const { hora, periodo } = formatarHorario12h(ag.horario_inicio);
        const { data, diaSemana } = formatarData(ag.data_agendamento);

        const card = document.createElement("div");
        card.className = "agendamento-card";
        card.innerHTML = `
            <div class="agendamento-info">
                <span class="barbeiro-label">Barbeiro</span>
                <span class="barbearia-nome">${ag.nome_barbeiro || "-"}</span>
                <span class="servico-label">Serviço: ${ag.nome_servico || "-"}</span>
                <span class="data-label">Data</span>
                <span class="data-valor">${data}</span>
            </div>
            <div class="agendamento-horario">
                <span class="horario">${hora}</span>
                <span class="periodo">${periodo}</span>
                <span class="dia-semana">${diaSemana}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

async function carregarPontuacao(usuario) {
    const { data, error } = await supabase
        .from("vw_pontuacao_usuario")
        .select("pontuacao_total")
        .eq("id_usuario", usuario.id_usuario)
        .single();

    if (error) {
        console.error("Erro ao carregar a pontuação:", error);
        return;
    }

    const elPontuacao = document.getElementById("pontuacao-usuario");
    if (elPontuacao) elPontuacao.textContent = data?.pontuacao_total ?? 0;
}

async function carregarAgendamentos(usuario) {
    const { data, error } = await supabase
        .from("vw_meus_agendamentos")
        .select("*")
        .eq("id_usuario", usuario.id_usuario)
        .order("data_agendamento", { ascending: false })
        .order("horario_inicio", { ascending: false });

    if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        const container = document.querySelector(".agendamentos-lista");
        if (container) {
            container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Erro ao carregar agendamentos.</p>`;
        }
        return;
    }

    renderizarAgendamentos(data || []);
}

function configurarBotaoRetornar() {
    const btn = document.querySelector(".btn-retornar");
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = "menu_cliente.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const usuario = pegarSessao();

    if (!usuario) {
        alert("Você não está logado! Redirecionando para o login...");
        window.location.href = "index.html";
        return;
    }

    exibirNomeCliente(usuario);
    configurarBotaoRetornar();

    if (!usuario.id_usuario) {
        console.warn("Nenhum id_usuario encontrado na sessão.");
        return;
    }

    carregarAgendamentos(usuario);
    carregarPontuacao(usuario);
});
