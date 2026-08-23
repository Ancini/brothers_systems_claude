import { buscarAbertos, buscarFechados } from "./abertos_fechados.js";
import { pegarSessao, supabaseClient } from "./session.js"; // <-- Importamos o supabaseClient daqui
import { salvarEtapaAgendamento } from "./agendamento_estado.js";

// Descobre, direto da tabela horario_funcionamento, a configuração de hoje de
// cada barbearia. Devolve um Map id_estabelicimento -> {aberto, horario_abertura,
// horario_fechamento} só com quem já tem esse dia configurado.
async function buscarConfigHojePorEstabelecimento() {
    const hojeDiaSemana = new Date().getDay(); // 0=domingo...6=sábado

    const { data, error } = await supabaseClient
        .from("horario_funcionamento")
        .select("id_estabelicimento, aberto, horario_abertura, horario_fechamento")
        .eq("dia_semana", hojeDiaSemana);

    if (error) {
        console.error("Erro ao buscar horario_funcionamento de hoje:", error);
        return new Map();
    }

    return new Map((data || []).map(linha => [linha.id_estabelicimento, linha]));
}

function paraMinutos(horaTexto) {
    const [h, m] = horaTexto.split(":").map(Number);
    return h * 60 + m;
}

function estaDentroDoHorario(horarioAbertura, horarioFechamento) {
    const agora = new Date();
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    return agoraMin >= paraMinutos(horarioAbertura) && agoraMin < paraMinutos(horarioFechamento);
}

// Decide se a barbearia está aberta agora. Quando existe configuração de hoje
// em horario_funcionamento, ela manda (pode tanto FECHAR uma que a view geral
// achava aberta quanto ABRIR uma que a view achava fechada, ex: horário
// especial de domingo). Sem configuração pra hoje, cai no que a view decidiu —
// exceto aos domingos, que por padrão consideramos fechado.
function estaAbertoAgora(idEstabelecimento, configHojePorId, abertoNaView) {
    const config = configHojePorId.get(idEstabelecimento);

    if (config) {
        if (!config.aberto) return false;
        if (!config.horario_abertura || !config.horario_fechamento) return true;
        return estaDentroDoHorario(config.horario_abertura, config.horario_fechamento);
    }

    if (new Date().getDay() === 0) return false;
    return abertoNaView;
}

async function carregarPontuacaoUsuario() {
    try {
        const usuario = pegarSessao();

        if (!usuario || !usuario.id_usuario) {
            console.warn("Nenhum usuário logado ou id_usuario não encontrado na sessão.");
            return;
        }

        const idUsuarioLogado = usuario.id_usuario; 

        const { data, error } = await supabaseClient
            .from('vw_pontuacao_usuario') 
            .select('pontuacao_total')
            .eq('id_usuario', idUsuarioLogado) // Certifique-se de que a coluna na View se chama 'id_usuario'
            .single();

        if (error) throw error;

        const elementoPontuacao = document.getElementById('pontuacao-usuario');
        if (elementoPontuacao && data) {
            // Exibe a pontuação total (se vier nula/undefined por algum motivo, exibe 0)
            elementoPontuacao.textContent = data.pontuacao_total ?? 0;
        }

    } catch (error) {
        console.error("Erro ao carregar a pontuação:", error);
    }
}

async function inicializarEstabelecimentos() {
    try {
        const [abertosView, fechadosView, configHojePorId] = await Promise.all([
            buscarAbertos(),
            buscarFechados(),
            buscarConfigHojePorEstabelecimento()
        ]);

        // Junta as duas listas da view e reclassifica cada uma usando
        // horario_funcionamento como fonte de verdade pra hoje — isso vale
        // tanto pra fechar quem a view achava aberto quanto pra abrir quem a
        // view achava fechado (ex: horário especial de domingo).
        const candidatos = [
            ...abertosView.map(est => ({ est, abertoNaView: true })),
            ...fechadosView.map(est => ({ est, abertoNaView: false }))
        ];

        const abertos = [];
        const fechados = [];

        candidatos.forEach(({ est, abertoNaView }) => {
            const id = est.id_estabelicimento ?? est.id_estabelecimento;
            if (estaAbertoAgora(id, configHojePorId, abertoNaView)) {
                abertos.push(est);
            } else {
                fechados.push(est);
            }
        });

        renderizar(abertos, "abertos");
        renderizar(fechados, "fechados");
    } catch (error) {
        console.error("Erro ao carregar os estabelecimentos:", error);
    }
}

// Escapa texto/URL vindos do banco antes de inserir via innerHTML — evita XSS armazenado.
function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function renderizar(lista, containerId) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.warn(`Container com ID '${containerId}' não foi encontrado no HTML.`);
        return;
    }

    container.innerHTML = "";

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <p style="color: #999; font-size: 14px; grid-column: 1/-1; text-align: center; padding: 20px;">
                Nenhum estabelecimento encontrado nesta categoria.
            </p>
        `;
        return;
    }

    lista.forEach(est => {
        const imagem = est.imagem_estab;
        const nome = est.nome_estabelecimento || est.nome_estabelicimento;
        const id = est.id_estabelicimento ?? est.id_estabelecimento; // cobre os dois nomes possíveis vindos da view

        const card = document.createElement("div");
        card.className = "estabelecimento-item";
        card.title = nome;
        card.innerHTML = `
            <div class="estabelecimento-imagem"><img src="${escapeHtml(imagem)}" alt="${escapeHtml(nome)}"></div>
            <span class="estabelecimento-nome">${escapeHtml(nome)}</span>
        `;

        card.addEventListener("click", () => {
            if (!id) {
                console.warn("Estabelecimento sem id_estabelicimento na view:", est);
            }
            salvarEtapaAgendamento({
                id_estabelicimento: id,
                nome_estabelicimento: nome
            });
            window.location.href = "agendamento_selecionar_barbearia.html";
        });

        container.appendChild(card);
    });
}

function configurarNavegacaoCards() {
    const cardAgendamentos = document.querySelector(".calendario-card");
    if (cardAgendamentos) {
        cardAgendamentos.style.cursor = "pointer";
        cardAgendamentos.addEventListener("click", () => {
            window.location.href = "meusAgendamentos.html";
        });
    }

    const cardRanking = document.querySelector(".ranking-card");
    if (cardRanking) {
        cardRanking.style.cursor = "pointer";
        cardRanking.addEventListener("click", () => {
            window.location.href = "raking.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarEstabelecimentos();
    carregarPontuacaoUsuario();
    configurarNavegacaoCards();
});