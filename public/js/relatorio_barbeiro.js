import { supabase } from "./supabase.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

let idBarbeiroLogado = null;

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarMoeda(valor) {
    return `R$${valor.toFixed(2).replace(".", ",")} Reais`;
}

async function inicializarIdentidadeBarbeiro() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: vinculo, error } = await supabase
        .from('prestador')
        .select('id_prestador, usuario:prestador_id_prestador_fkey ( nome_usuario )')
        .eq('uuid_vinculo', user.id)
        .limit(1);

    if (error || !vinculo || vinculo.length === 0) return false;

    idBarbeiroLogado = vinculo[0].id_prestador;

    const elNome = document.getElementById("barbeiro-nome");
    if (elNome && vinculo[0].usuario?.nome_usuario) {
        elNome.textContent = vinculo[0].usuario.nome_usuario;
    }

    return true;
}

async function buscarResumo(dataInicio, dataFim) {
    const { data, error } = await supabase
        .from('vw_agenda_do_barbeiro')
        .select('valor_servico')
        .eq('id_prestador', idBarbeiroLogado)
        .gte('data_agendamento', dataInicio)
        .lt('data_agendamento', dataFim);

    if (error) {
        console.error("Erro ao buscar resumo do relatório:", error);
        return { total: 0, quantidade: 0 };
    }

    const total = (data || []).reduce((soma, ag) => soma + Number(ag.valor_servico || 0), 0);
    return { total, quantidade: data ? data.length : 0 };
}

async function carregarResumoHoje() {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const { total, quantidade } = await buscarResumo(
        `${formatarDataBanco(hoje)}T00:00:00`,
        `${formatarDataBanco(amanha)}T00:00:00`
    );

    const elVendas = document.getElementById("stat-vendas-hoje");
    const elAgendamentos = document.getElementById("stat-agendamentos-hoje");
    if (elVendas) elVendas.textContent = formatarMoeda(total);
    if (elAgendamentos) elAgendamentos.textContent = quantidade;
}

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function calcularIntervaloPeriodo(tipo) {
    const hoje = new Date();

    if (tipo === "dia") {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + 1);
        const dataTexto = `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}/${inicio.getFullYear()}`;
        return { inicio, fim, texto: `Em Hoje (${dataTexto})` };
    }

    if (tipo === "ano") {
        const inicio = new Date(hoje.getFullYear(), 0, 1);
        const fim = new Date(hoje.getFullYear() + 1, 0, 1);
        return { inicio, fim, texto: `Em ${hoje.getFullYear()}` };
    }

    // "mes" (padrão)
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return { inicio, fim, texto: `Em ${capitalizar(MESES[hoje.getMonth()])} de ${hoje.getFullYear()}` };
}

async function filtrarRelatorio(tipo) {
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.toggle('ativo', btn.dataset.periodo === tipo);
    });

    const { inicio, fim, texto } = calcularIntervaloPeriodo(tipo);

    const elPeriodo = document.getElementById("periodo-info");
    if (elPeriodo) elPeriodo.textContent = texto;

    const { total, quantidade } = await buscarResumo(
        `${formatarDataBanco(inicio)}T00:00:00`,
        `${formatarDataBanco(fim)}T00:00:00`
    );

    const elValor = document.getElementById("valor-periodo");
    const elCortes = document.getElementById("cortes-periodo");
    if (elValor) elValor.textContent = formatarMoeda(total);
    if (elCortes) elCortes.textContent = `${quantidade} cabelos`;
}

function configurarBotoes() {
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => filtrarRelatorio(btn.dataset.periodo));
    });

    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = 'menu_inicial_barbeiro.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    configurarBotoes();

    const sucesso = await inicializarIdentidadeBarbeiro();
    if (!sucesso) {
        console.error("Não foi possível identificar o barbeiro. Verifique o login ou o vínculo no banco.");
        return;
    }

    await carregarResumoHoje();
    await filtrarRelatorio("mes");
});
