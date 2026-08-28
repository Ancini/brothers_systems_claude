import { pegarSessao } from "./session.js";
import { supabase } from "./supabase.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Preenchido no DOMContentLoaded, usado pelos filtros de período depois.
let funcionariosDoDono = [];

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarMoeda(valor) {
    return `R$${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Reais`;
}

function formatarMoedaCurta(valor) {
    return `R$${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function preencherNomeDono() {
    const usuario = pegarSessao();
    const elNome = document.getElementById("dono-nome");
    if (!elNome) return;

    const nomeCompleto = usuario?.nome || usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Proprietário";
    elNome.textContent = nomeCompleto;
}

// Mesmo padrão de identidade usado em outras_funcionalidades.js e
// cadastrar_porcentagem_barbeiro.js: acha o id_prestador do dono logado
// pelo uuid_vinculo.
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

// Lojas onde esse prestador está marcado como dono (proprietario_estab = true).
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

// Todo mundo que trabalha nas lojas desse dono, o próprio dono incluído
// (diferente de cadastrar_porcentagem_barbeiro.js, que exclui o dono da
// lista — aqui o relatório mostra a parte de todo mundo, dono também, se
// ele também atender clientes e tiver uma % configurada).
async function carregarFuncionariosDoDono(idsEstabelecimentos) {
    if (!idsEstabelecimentos || idsEstabelecimentos.length === 0) return [];

    const { data, error } = await supabase
        .from("prestador")
        .select("id_prestador, porcentagem_comissao, proprietario_estab, usuario:prestador_id_prestador_fkey ( nome_usuario )")
        .in("id_estabelicimento", idsEstabelecimentos);

    if (error) {
        console.error("Erro ao buscar funcionários do estabelecimento:", error);
        return [];
    }

    // Um mesmo prestador pode ter uma linha por loja — remove duplicatas
    // caso o dono tenha mais de um estabelecimento com o mesmo funcionário.
    // Se em QUALQUER linha ele aparecer marcado como proprietario_estab,
    // já entra como dono (souDono nunca deve "regredir" pra false numa
    // linha seguinte do mesmo prestador).
    const funcionarios = new Map();
    (data || []).forEach(linha => {
        if (linha.usuario?.nome_usuario) {
            const existente = funcionarios.get(linha.id_prestador);
            funcionarios.set(linha.id_prestador, {
                id_prestador: linha.id_prestador,
                nome: linha.usuario.nome_usuario,
                porcentagemComissao: linha.porcentagem_comissao,
                souDono: Boolean(existente?.souDono) || linha.proprietario_estab === true
            });
        }
    });

    return Array.from(funcionarios.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

// Soma o valor_servico de tudo que esse prestador atendeu no período,
// ignorando agendamentos cancelados (mesmo critério de
// controle_barbeiro.js / selecionar_horario.js).
async function buscarVendasDoPrestador(idPrestador, dataInicioISO, dataFimISO) {
    const { data, error } = await supabase
        .from("vw_agenda_do_barbeiro")
        .select("valor_servico, status")
        .eq("id_prestador", idPrestador)
        .gte("data_agendamento", dataInicioISO)
        .lt("data_agendamento", dataFimISO);

    if (error) {
        console.error(`Erro ao buscar vendas do prestador ${idPrestador}:`, error);
        return 0;
    }

    return (data || [])
        .filter(ag => !(ag.status || "").toLowerCase().includes("cancel"))
        .reduce((soma, ag) => soma + Number(ag.valor_servico || 0), 0);
}

function renderFuncionarios(lista) {
    const container = document.getElementById("funcionarios-lista");
    if (!container) return;

    container.innerHTML = "";

    if (lista.length === 0) {
        const aviso = document.createElement("div");
        aviso.className = "funcionarios-vazio";
        aviso.textContent = "Nenhum funcionário encontrado pra esse estabelecimento.";
        container.appendChild(aviso);
        return;
    }

    lista.forEach(funcionario => {
        const card = document.createElement("div");
        card.className = "funcionario-card";

        // O dono do estabelecimento fica sempre com 100% do que ele mesmo
        // vendeu — fixo, não depende de porcentagem_comissao (que nem faz
        // sentido pra ele, já que essa % é pensada pra funcionário).
        const temPorcentagem = funcionario.porcentagemComissao !== null && funcionario.porcentagemComissao !== undefined;
        const valorComissao = funcionario.souDono
            ? formatarMoedaCurta(funcionario.vendas)
            : temPorcentagem
                ? formatarMoedaCurta(funcionario.vendas * (Number(funcionario.porcentagemComissao) / 100))
                : "Sem % definida";

        card.innerHTML = `
            <img src="css/imagens/desenho_barbeiro.png" alt="" class="funcionario-foto">
            <div class="funcionario-info">
                <div class="funcionario-nome"></div>
                <div class="funcionario-vendas">Total em vendas: ${formatarMoedaCurta(funcionario.vendas)}</div>
            </div>
            <div class="funcionario-comissao">
                <div class="funcionario-comissao-label">Parte do funcionário</div>
                <div class="funcionario-comissao-valor">${valorComissao}</div>
            </div>
        `;
        card.querySelector(".funcionario-nome").textContent = funcionario.nome;
        container.appendChild(card);
    });
}

function calcularIntervaloPeriodo(tipo) {
    const hoje = new Date();

    if (tipo === "semana") {
        const inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - hoje.getDay());
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + 7);
        const dataInicioTexto = `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}`;
        const dataFimTexto = `${String(fim.getDate() - 1).padStart(2, "0")}/${String(fim.getMonth() + 1).padStart(2, "0")}`;
        return { inicio, fim, texto: `Semana de ${dataInicioTexto} até ${dataFimTexto}` };
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

async function aplicarPeriodoNaTela(texto, inicio, fim) {
    const elPeriodo = document.getElementById("periodo-info");
    if (elPeriodo) elPeriodo.textContent = texto;

    const dataInicioISO = `${formatarDataBanco(inicio)}T00:00:00`;
    const dataFimISO = `${formatarDataBanco(fim)}T00:00:00`;

    const vendasPorFuncionario = await Promise.all(
        funcionariosDoDono.map(f => buscarVendasDoPrestador(f.id_prestador, dataInicioISO, dataFimISO))
    );

    let totalArrecadado = 0;
    const listaComVendas = funcionariosDoDono.map((f, indice) => {
        const vendas = vendasPorFuncionario[indice];
        totalArrecadado += vendas;
        return { ...f, vendas };
    });

    const elValor = document.getElementById("valor-total");
    if (elValor) elValor.textContent = formatarMoeda(totalArrecadado);
    renderFuncionarios(listaComVendas);
}

async function filtrarPeriodo(tipo) {
    document.querySelectorAll(".filtro-btn").forEach(btn => {
        btn.classList.toggle("ativo", btn.dataset.periodo === tipo);
    });

    const painel = document.getElementById("painel-intervalo");
    if (painel) painel.classList.remove("aberto");

    const { inicio, fim, texto } = calcularIntervaloPeriodo(tipo);
    await aplicarPeriodoNaTela(texto, inicio, fim);
}

function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

async function aplicarIntervaloPersonalizado() {
    const inicioTexto = document.getElementById("data-inicio")?.value;
    const fimTexto = document.getElementById("data-fim")?.value;
    if (!inicioTexto || !fimTexto) return;

    const [anoInicio, mesInicio, diaInicio] = inicioTexto.split("-").map(Number);
    const [anoFim, mesFim, diaFim] = fimTexto.split("-").map(Number);
    const inicio = new Date(anoInicio, mesInicio - 1, diaInicio);
    // Intervalo exclusivo no fim (< dataFim), então soma 1 dia pra incluir o dia escolhido inteiro.
    const fim = new Date(anoFim, mesFim - 1, diaFim + 1);

    document.querySelectorAll(".filtro-btn").forEach(btn => btn.classList.remove("ativo"));
    await aplicarPeriodoNaTela(`De ${formatarDataBR(inicioTexto)} até ${formatarDataBR(fimTexto)}`, inicio, fim);
}

function configurarBotoes() {
    document.querySelectorAll(".filtro-btn").forEach(btn => {
        btn.addEventListener("click", () => filtrarPeriodo(btn.dataset.periodo));
    });

    const btnIntervalo = document.getElementById("btn-intervalo");
    const painelIntervalo = document.getElementById("painel-intervalo");
    if (btnIntervalo && painelIntervalo) {
        btnIntervalo.addEventListener("click", () => {
            painelIntervalo.classList.toggle("aberto");
        });
    }

    const btnAplicarIntervalo = document.getElementById("btn-aplicar-intervalo");
    if (btnAplicarIntervalo) {
        btnAplicarIntervalo.addEventListener("click", aplicarIntervaloPersonalizado);
    }

    const btnVoltar = document.getElementById("btn-voltar");
    if (btnVoltar) {
        btnVoltar.addEventListener("click", () => {
            window.location.href = "menu_inicial_barbeiro.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    preencherNomeDono();
    configurarBotoes();

    const idPrestadorLogado = await identificarPrestadorLogado();
    if (idPrestadorLogado) {
        const idsEstabelecimentos = await buscarEstabelecimentosDoDono(idPrestadorLogado);
        funcionariosDoDono = await carregarFuncionariosDoDono(idsEstabelecimentos);
    } else {
        console.error("Não foi possível identificar o dono logado. Verifique o login ou o vínculo no banco.");
    }

    await filtrarPeriodo("mes");
});
