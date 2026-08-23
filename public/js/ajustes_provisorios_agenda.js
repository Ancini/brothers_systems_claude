// Ajustes PROVISÓRIOS por id_estabelicimento, feitos "na mão" enquanto a tela/tabela
// de dias de funcionamento (horario_funcionamento) não existe de verdade — combinado em
// 2026-08-23. Quando aquela tabela estiver pronta e ligada, apagar este arquivo inteiro
// e os pontos em selecionar_data.js / selecionar_horario.js que o importam.
export const AJUSTES_PROVISORIOS_POR_ESTABELECIMENTO = {
    5: { // GabSpiesUnhas — não abre terça-feira, fecha 16h aos sábados (normal fecha 19:30)
        diasFechados: [2], // 0=domingo ... 6=sábado, igual ao Date.getDay()
        fechamentoSabadoMin: 16 * 60
    }
};

export function pegarAjustesProvisorios(idEstabelecimento) {
    return AJUSTES_PROVISORIOS_POR_ESTABELECIMENTO[Number(idEstabelecimento)] || null;
}
