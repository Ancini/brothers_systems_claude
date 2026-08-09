// public/js/agendamento_estado.js
// Guarda os dados escolhidos ao longo do fluxo de agendamento
// (barbearia -> barbeiro -> serviço -> horário -> confirmação)
// usando sessionStorage, que é limpo quando a aba fecha.

const CHAVE = "agendamentoEmAndamento";

export function salvarEtapaAgendamento(dadosParciais) {
    const atual = pegarAgendamentoEmAndamento() || {};
    const atualizado = { ...atual, ...dadosParciais };
    sessionStorage.setItem(CHAVE, JSON.stringify(atualizado));
    return atualizado;
}

export function pegarAgendamentoEmAndamento() {
    const dados = sessionStorage.getItem(CHAVE);
    return dados ? JSON.parse(dados) : null;
}

export function limparAgendamentoEmAndamento() {
    sessionStorage.removeItem(CHAVE);
}
