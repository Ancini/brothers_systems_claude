import { buscarAbertos, buscarFechados } from "./abertos_fechados.js";
import { pegarSessao, supabaseClient } from "./session.js"; // <-- Importamos o supabaseClient daqui
import { salvarEtapaAgendamento } from "./agendamento_estado.js";

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
        const abertos = await buscarAbertos();
        const fechados = await buscarFechados();

        renderizar(abertos, "abertos");
        renderizar(fechados, "fechados");
    } catch (error) {
        console.error("Erro ao carregar os estabelecimentos:", error);
    }
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
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="estabelecimento-logo">
                <img src="${imagem}" alt="${nome}">
            </div>
            <div class="estabelecimento-nome">${nome}</div>
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

document.addEventListener("DOMContentLoaded", () => {
    inicializarEstabelecimentos();
    carregarPontuacaoUsuario();
});