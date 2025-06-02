let dadosResumo = [];
let visualizacaoAtual = 'quantidade';
let filtrosAtuais = {
    ano: 'todos',
    eixo: 'todos',
    natureza: 'todos',
    fundos: ['FUSP', 'FECAM', 'Emendas Estaduais', 'Emendas Federais']
};

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(valor);
}

function formatarNumero(valor) {
    return new Intl.NumberFormat('pt-BR').format(valor);
}

function getDadosResumo() {
    return dadosResumo;
}

function setDadosResumo(dados) {
    dadosResumo.length = 0;
    dadosResumo.push(...dados);
}

function getVisualizacaoAtual() {
    return visualizacaoAtual;
}

function setVisualizacaoAtual(valor) {
    visualizacaoAtual = valor;
}

function getFiltrosAtuais() {
    return filtrosAtuais;
}

function setFiltrosAtuais(filtros) {
    Object.assign(filtrosAtuais, filtros);
}

function updateFiltrosAtuais(key, value) {
    filtrosAtuais[key] = value;
}

export {
    getDadosResumo,
    setDadosResumo,
    getVisualizacaoAtual,
    setVisualizacaoAtual,
    getFiltrosAtuais,
    setFiltrosAtuais,
    updateFiltrosAtuais,
    formatarMoeda,
    formatarNumero
};