import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatarData(dataTexto) {
    if (!dataTexto) return { valor: "-", diaSemana: "-" };
    const [ano, mes, dia] = dataTexto.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    const mesCapitalizado = MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1);
    return {
        valor: `${dia} de ${mesCapitalizado} de ${ano}`,
        diaSemana: DIAS_SEMANA[data.getDay()]
    };
}

function formatarHorario12h(horaTexto) {
    if (!horaTexto) return { hora: "--:--", periodo: "" };
    const [h, m] = horaTexto.split(":").map(Number);
    const periodo = h < 12 ? "AM" : "PM";
    const hora12 = h % 12 === 0 ? 12 : h % 12;
    return { hora: `${String(hora12).padStart(2, "0")}:${String(m).padStart(2, "0")}`, periodo };
}

async function carregarCliente(usuario) {
    const elNome = document.querySelector(".cliente-info .nome");
    if (elNome) elNome.textContent = usuario.user_metadata?.name || usuario.email?.split("@")[0] || "Cliente";

    const { data, error } = await supabase
        .from("vw_pontuacao_usuario")
        .select("pontuacao_total")
        .eq("id_usuario", usuario.id_usuario)
        .single();

    const elPontuacao = document.querySelector(".pontuacao-valor");
    if (elPontuacao) elPontuacao.textContent = (error || !data) ? 0 : (data.pontuacao_total ?? 0);
}

async function carregarAgendamentos(usuario) {
    const container = document.querySelector(".agendamentos-lista");
    const elTotal = document.querySelector(".agendamentos-total");
    if (!container) return;

    const { data, error } = await supabase
        .from("agendamento")
        .select(`
            id_agendamento,
            data_agendamento,
            horario_inicio,
            status,
            servico_estabelicimento ( servico ( nome_servico ) ),
            prestador ( usuario:prestador_id_prestador_fkey ( nome_usuario ) )
        `)
        .eq("id_usuario", usuario.id_usuario)
        .order("data_agendamento", { ascending: true })
        .order("horario_inicio", { ascending: true });

    container.innerHTML = "";

    if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Erro ao carregar seus agendamentos.</p>`;
        if (elTotal) elTotal.textContent = "0";
        return;
    }

    const agendamentos = (data || []).filter(ag => !(ag.status || "").toLowerCase().includes("cancel"));

    if (elTotal) elTotal.textContent = agendamentos.length;

    if (agendamentos.length === 0) {
        container.innerHTML = `<p style="color:#999;text-align:center;padding:20px;">Você ainda não tem agendamentos.</p>`;
        return;
    }

    agendamentos.forEach(ag => {
        const nomeBarbeiro = ag.prestador?.usuario?.nome_usuario || "-";
        const nomeServico = ag.servico_estabelicimento?.servico?.nome_servico || "-";
        const { valor: dataValor, diaSemana } = formatarData(ag.data_agendamento);
        const { hora, periodo } = formatarHorario12h(ag.horario_inicio);

        const card = document.createElement("div");
        card.className = "agendamento-card";
        card.innerHTML = `
            <div class="agendamento-info">
                <span class="barbeiro-label">Barbeiro</span>
                <span class="barbearia-nome">${nomeBarbeiro}</span>
                <span class="servico-label">Serviço: ${nomeServico}</span>
                <span class="data-label">Data</span>
                <span class="data-valor">${dataValor}</span>
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

function configurarBotaoRetornar() {
    const btn = document.querySelector(".btn-retornar");
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = "menu_cliente.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const usuario = pegarSessao();

    if (!usuario || !usuario.id_usuario) {
        alert("Você não está logado! Redirecionando para o login...");
        window.location.href = "index.html";
        return;
    }

    configurarBotaoRetornar();
    await Promise.all([
        carregarCliente(usuario),
        carregarAgendamentos(usuario)
    ]);
});
