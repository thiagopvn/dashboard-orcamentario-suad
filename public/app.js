import { db, auth, verificarAutenticacao, fazerLogin, fazerLogout, carregarDados, atualizarDado, criarRegistro, excluirRegistro, migrarDadosIniciais } from './firebase.js';

let dadosResumo = [];
let visualizacaoAtual = 'quantidade';
let filtrosAtuais = {
    ano: 'todos',
    eixo: 'todos',
    natureza: 'todos',
    fundos: ['FUSP', 'FECAM', 'Emendas Estaduais', 'Emendas Federais']
};
let charts = {};
let abaAtual = 'geral';

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

function atualizarFundosSelecionados() {
    const fundosSelecionados = [];
    if (document.getElementById('filtroFUSP').checked) fundosSelecionados.push('FUSP');
    if (document.getElementById('filtroFECAM').checked) fundosSelecionados.push('FECAM');
    if (document.getElementById('filtroEmendasEstaduais').checked) fundosSelecionados.push('Emendas Estaduais');
    if (document.getElementById('filtroEmendasFederais').checked) fundosSelecionados.push('Emendas Federais');
    filtrosAtuais.fundos = fundosSelecionados;
}

function atualizarTabela() {
    const tbody = document.getElementById('tabelaDados');
    tbody.innerHTML = '';
    
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza) &&
               (filtrosAtuais.fundos.includes(d.fundo));
    });
    
    dadosFiltrados.sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        if (a.fundo !== b.fundo) return a.fundo.localeCompare(b.fundo);
        if (a.eixo !== b.eixo) return a.eixo.localeCompare(b.eixo);
        return a.natureza.localeCompare(b.natureza);
    });
    
    const colObjetos = document.getElementById('colObjetos');
    colObjetos.textContent = visualizacaoAtual === 'quantidade' ? 'Objetos Adquiridos' : 'Lista de Objetos';
    
    dadosFiltrados.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        const docId = `${d.ano}_${d.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${d.natureza}_${d.fundo.replace(/[^a-zA-Z0-9]/g, '')}`;
        tr.setAttribute('data-id', docId);
        
        if (d.empenhado === 0 && d.liquidado === 0) {
            tr.classList.add('text-gray-400');
        }
        
        let objetosCell;
        if (visualizacaoAtual === 'quantidade') {
            objetosCell = formatarNumero(d.objetos);
        } else {
            if (d.itens && d.itens.length > 0) {
                objetosCell = `<div class="flex flex-wrap gap-1">
                    ${d.itens.map(item => `<span class="inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded-full">${item}</span>`).join('')}
                </div>`;
            } else {
                objetosCell = '-';
            }
        }
        
        const camposExtras = d.fundo === 'Emendas Federais' ? `
            ${d.numeroEmenda ? `<div class="text-xs text-gray-600">Emenda: ${d.numeroEmenda}</div>` : ''}
            ${d.parlamentar ? `<div class="text-xs text-gray-600">Parlamentar: ${d.parlamentar}</div>` : ''}
        ` : '';
        
        tr.innerHTML = `
            <td class="px-4 py-2">${d.ano}</td>
            <td class="px-4 py-2">${d.eixo}</td>
            <td class="px-4 py-2">${d.natureza}</td>
            <td class="px-4 py-2">
                <span class="inline-block px-2 py-1 text-xs rounded-full ${
                    d.fundo === 'FUSP' ? 'bg-blue-100 text-blue-800' :
                    d.fundo === 'FECAM' ? 'bg-green-100 text-green-800' :
                    d.fundo === 'Emendas Estaduais' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-purple-100 text-purple-800'
                }">${d.fundo}</span>
                ${camposExtras}
            </td>
            <td class="px-4 py-2 editable-cell cursor-pointer hover:bg-blue-50" data-field="empenhado" data-value="${d.empenhado}">${formatarMoeda(d.empenhado)}</td>
            <td class="px-4 py-2 editable-cell cursor-pointer hover:bg-blue-50" data-field="liquidado" data-value="${d.liquidado}">${formatarMoeda(d.liquidado)}</td>
            <td class="px-4 py-2 editable-cell cursor-pointer hover:bg-blue-50" data-field="objetos" data-value="${d.objetos}" data-items='${JSON.stringify(d.itens || [])}'>${objetosCell}</td>
            <td class="px-4 py-2 editable-cell cursor-pointer hover:bg-blue-50" data-field="prestadas" data-value="${d.prestadas}">${formatarNumero(d.prestadas)}</td>
            <td class="px-4 py-2 btn-edit-control">
                <button class="btn-excluir text-red-600 hover:text-red-800" data-id="${docId}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', function() {
            mostrarFormularioEdicao(this);
        });
    });
    
    document.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', function() {
            const docId = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este registro?')) {
                excluirRegistro(docId).then(() => carregarDadosDoFirebase());
            }
        });
    });
    
    if (dadosFiltrados.length > 0) {
        const totaisPorFundo = {};
        
        dadosFiltrados.forEach(d => {
            if (!totaisPorFundo[d.fundo]) {
                totaisPorFundo[d.fundo] = {
                    empenhado: 0,
                    liquidado: 0,
                    objetos: 0,
                    prestadas: 0,
                    itens: new Set()
                };
            }
            
            totaisPorFundo[d.fundo].empenhado += d.empenhado;
            totaisPorFundo[d.fundo].liquidado += d.liquidado;
            totaisPorFundo[d.fundo].objetos += d.objetos;
            totaisPorFundo[d.fundo].prestadas += d.prestadas;
            
            if (d.itens) {
                d.itens.forEach(item => totaisPorFundo[d.fundo].itens.add(item));
            }
        });
        
        Object.entries(totaisPorFundo).forEach(([fundo, totais]) => {
            const trTotal = document.createElement('tr');
            trTotal.className = 'font-bold bg-gray-100';
            
            let objetosTotaisCell;
            if (visualizacaoAtual === 'quantidade') {
                objetosTotaisCell = formatarNumero(totais.objetos);
            } else {
                objetosTotaisCell = `<strong>${totais.itens.size} tipos</strong>`;
            }
            
            trTotal.innerHTML = `
                <td colspan="3" class="px-4 py-2">TOTAL ${fundo.toUpperCase()}</td>
                <td class="px-4 py-2">
                    <span class="inline-block px-2 py-1 text-xs rounded-full ${
                        fundo === 'FUSP' ? 'bg-blue-100 text-blue-800' :
                        fundo === 'FECAM' ? 'bg-green-100 text-green-800' :
                        fundo === 'Emendas Estaduais' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-100 text-purple-800'
                    }">${fundo}</span>
                </td>
                <td class="px-4 py-2">${formatarMoeda(totais.empenhado)}</td>
                <td class="px-4 py-2">${formatarMoeda(totais.liquidado)}</td>
                <td class="px-4 py-2">${objetosTotaisCell}</td>
                <td class="px-4 py-2">${formatarNumero(totais.prestadas)}</td>
                <td class="px-4 py-2 btn-edit-control"></td>
            `;
            tbody.appendChild(trTotal);
        });
    }
}

function atualizarResumos() {
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza) &&
               (filtrosAtuais.fundos.includes(d.fundo));
    });
    
    const totais = dadosFiltrados.reduce((acc, d) => {
        acc.empenhado += d.empenhado;
        acc.liquidado += d.liquidado;
        acc.objetos += d.objetos;
        acc.prestadas += d.prestadas;
        return acc;
    }, { empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0 });
    
    const todosItens = new Set();
    dadosFiltrados.forEach(d => {
        if (d.itens) {
            d.itens.forEach(item => todosItens.add(item));
        }
    });
    
    document.getElementById('totalEmpenhado').textContent = formatarMoeda(totais.empenhado);
    document.getElementById('totalLiquidado').textContent = formatarMoeda(totais.liquidado);
    
    if (visualizacaoAtual === 'quantidade') {
        document.getElementById('totalObjetos').textContent = formatarNumero(totais.objetos);
    } else {
        document.getElementById('totalObjetos').textContent = formatarNumero(todosItens.size);
    }
    
    document.getElementById('totalContasPrestadas').textContent = formatarNumero(totais.prestadas);
}

function prepararDadosGraficos() {
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza) &&
               (filtrosAtuais.fundos.includes(d.fundo));
    });
    
    const cores = {
        'FUSP': 'rgba(59, 130, 246, 0.8)',
        'FECAM': 'rgba(34, 197, 94, 0.8)',
        'Emendas Estaduais': 'rgba(251, 191, 36, 0.8)',
        'Emendas Federais': 'rgba(168, 85, 247, 0.8)'
    };
    
    const dadosEixo = {
        labels: ['EVM', 'VPSP-MQVPSP', 'ECV-FISPDS-RMVI'],
        datasets: filtrosAtuais.fundos.map(fundo => ({
            label: fundo,
            data: [
                dadosFiltrados.filter(d => d.eixo === 'EVM' && d.fundo === fundo).reduce((sum, d) => sum + d.empenhado, 0),
                dadosFiltrados.filter(d => d.eixo === 'VPSP-MQVPSP' && d.fundo === fundo).reduce((sum, d) => sum + d.empenhado, 0),
                dadosFiltrados.filter(d => d.eixo === 'ECV-FISPDS-RMVI' && d.fundo === fundo).reduce((sum, d) => sum + d.empenhado, 0)
            ],
            backgroundColor: cores[fundo],
            borderWidth: 1
        }))
    };
    
    const anos = [2019, 2020, 2021, 2022, 2023, 2024];
    const dadosAno = {
        labels: anos,
        datasets: [
            {
                label: 'Empenhado',
                data: anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.empenhado, 0)),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            },
            {
                label: 'Liquidado',
                data: anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.liquidado, 0)),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1
            }
        ]
    };
    
    const dadosComparativo = {
        labels: ['Custeio', 'Investimento'],
        datasets: filtrosAtuais.fundos.map(fundo => ({
            label: fundo,
            data: [
                dadosFiltrados.filter(d => d.natureza === 'Custeio' && d.fundo === fundo).reduce((sum, d) => sum + d.empenhado, 0),
                dadosFiltrados.filter(d => d.natureza === 'Investimento' && d.fundo === fundo).reduce((sum, d) => sum + d.empenhado, 0)
            ],
            backgroundColor: cores[fundo],
            borderWidth: 1
        }))
    };
    
    let objetosData, prestadasData;
    
    if (visualizacaoAtual === 'quantidade') {
        objetosData = anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.objetos, 0));
        prestadasData = anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.prestadas, 0));
    } else {
        objetosData = anos.map(ano => {
            const itensUnicos = new Set();
            dadosFiltrados.filter(d => d.ano === ano).forEach(d => {
                if (d.itens) {
                    d.itens.forEach(item => itensUnicos.add(item));
                }
            });
            return itensUnicos.size;
        });
        prestadasData = objetosData;
    }
    
    const dadosObjetos = {
        labels: anos,
        datasets: [
            {
                label: visualizacaoAtual === 'quantidade' ? 'Quantidade de Objetos' : 'Tipos de Objetos',
                data: objetosData,
                backgroundColor: 'rgba(251, 191, 36, 0.5)',
                borderColor: 'rgba(251, 191, 36, 1)',
                borderWidth: 1
            },
            {
                label: visualizacaoAtual === 'quantidade' ? 'Contas Prestadas' : 'Tipos com Contas Prestadas',
                data: prestadasData,
                backgroundColor: 'rgba(168, 85, 247, 0.5)',
                borderColor: 'rgba(168, 85, 247, 1)',
                borderWidth: 1
            }
        ]
    };
    
    return { dadosEixo, dadosAno, dadosComparativo, dadosObjetos };
}

function atualizarGraficos() {
    const { dadosEixo, dadosAno, dadosComparativo, dadosObjetos } = prepararDadosGraficos();
    
    const opcoes = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatarMoeda(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };
    
    const opcoesObjetos = {
        ...opcoes,
        plugins: {
            ...opcoes.plugins,
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatarNumero(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };
    
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    charts.eixo = new Chart(document.getElementById('eixoChart'), {
        type: 'bar',
        data: dadosEixo,
        options: opcoes
    });
    
    charts.ano = new Chart(document.getElementById('anoChart'), {
        type: 'line',
        data: dadosAno,
        options: opcoes
    });
    
    charts.comparativo = new Chart(document.getElementById('comparativoChart'), {
        type: 'bar',
        data: dadosComparativo,
        options: opcoes
    });
    
    charts.objetos = new Chart(document.getElementById('objetosChart'), {
        type: 'bar',
        data: dadosObjetos,
        options: opcoesObjetos
    });
}

function atualizarVisualizacao() {
    atualizarTabela();
    atualizarResumos();
    atualizarGraficos();
}

async function carregarDadosDoFirebase() {
    const resultado = await carregarDados();
    
    if (resultado.sucesso) {
        dadosResumo = resultado.dados;
        atualizarVisualizacao();
    } else {
        alert(resultado.mensagem);
    }
}

function mostrarFormularioEdicao(cell) {
    const row = cell.parentNode;
    const docId = row.getAttribute('data-id');
    const field = cell.getAttribute('data-field');
    const currentValue = parseFloat(cell.getAttribute('data-value'));
    const registro = dadosResumo.find(d => {
        const id = `${d.ano}_${d.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${d.natureza}_${d.fundo.replace(/[^a-zA-Z0-9]/g, '')}`;
        return id === docId;
    });
    
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center';
    document.body.appendChild(overlay);
    
    const form = document.createElement('div');
    form.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto';
    
    let formHtml = `
        <h4 class="text-xl font-semibold mb-4">Editar ${
            field === 'empenhado' ? 'Valor Empenhado' : 
            field === 'liquidado' ? 'Valor Liquidado' : 
            field === 'objetos' ? 'Objetos Adquiridos' : 'Contas Prestadas'
        }</h4>
        <div class="mb-4">
    `;
    
    if (field === 'objetos') {
        const items = JSON.parse(cell.getAttribute('data-items'));
        
        formHtml += `
            <label class="block text-sm font-medium text-gray-700 mb-2">Quantidade</label>
            <input type="number" id="valor-edit" value="${currentValue}" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            
            <div class="mt-4">
                <h5 class="font-medium mb-2">Lista de Objetos</h5>
                <div id="items-container" class="space-y-2">
        `;
        
        items.forEach((item, index) => {
            formHtml += `
                <div class="flex items-center space-x-2">
                    <input type="text" value="${item}" class="item-input flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button type="button" class="remove-item bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        
        formHtml += `
                </div>
                <button type="button" id="add-item" class="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg">
                    <i class="fas fa-plus"></i> Adicionar Item
                </button>
            </div>
        `;
    } else {
        formHtml += `
            <label class="block text-sm font-medium text-gray-700 mb-2">Valor</label>
            <input type="number" id="valor-edit" value="${currentValue}" step="${field === 'empenhado' || field === 'liquidado' ? '0.01' : '1'}" 
                   class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        `;
    }
    
    if (registro.fundo === 'Emendas Federais') {
        formHtml += `
            <div class="mt-4 p-4 bg-purple-50 rounded-lg">
                <h5 class="font-medium mb-2">Campos Extras - Emendas Federais</h5>
                <div class="space-y-2">
                    <input type="text" id="numeroEmenda" placeholder="Número da Emenda" value="${registro.numeroEmenda || ''}" 
                           class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <input type="text" id="parlamentar" placeholder="Parlamentar" value="${registro.parlamentar || ''}" 
                           class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <select id="tipo" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">Tipo</option>
                        <option value="RP6" ${registro.tipo === 'RP6' ? 'selected' : ''}>RP6</option>
                        <option value="RP7" ${registro.tipo === 'RP7' ? 'selected' : ''}>RP7</option>
                    </select>
                </div>
            </div>
        `;
    }
    
    formHtml += `
        </div>
        <div class="flex justify-end space-x-2">
            <button type="button" id="cancel-edit" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">
                Cancelar
            </button>
            <button type="button" id="save-edit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Salvar
            </button>
        </div>
    `;
    
    form.innerHTML = formHtml;
    overlay.appendChild(form);
    
    document.getElementById('cancel-edit').addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    
    document.getElementById('save-edit').addEventListener('click', function() {
        salvarEdicao(docId, field, overlay, registro);
    });
    
    const addItemBtn = document.getElementById('add-item');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', function() {
            const container = document.getElementById('items-container');
            const newItemGroup = document.createElement('div');
            newItemGroup.className = 'flex items-center space-x-2';
            newItemGroup.innerHTML = `
                <input type="text" value="" class="item-input flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button type="button" class="remove-item bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(newItemGroup);
            
            newItemGroup.querySelector('.remove-item').addEventListener('click', function() {
                container.removeChild(newItemGroup);
            });
        });
    }
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemGroup = this.parentNode;
            itemGroup.parentNode.removeChild(itemGroup);
        });
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

async function salvarEdicao(docId, field, overlay, registro) {
    try {
        const novoValor = document.getElementById('valor-edit').value;
        let dadosAtualizacao = {};
        
        if (field === 'objetos') {
            const itemInputs = document.querySelectorAll('.item-input');
            const itens = Array.from(itemInputs).map(input => input.value).filter(val => val.trim() !== '');
            dadosAtualizacao = { [field]: parseFloat(novoValor), itens };
        } else {
            dadosAtualizacao[field] = field === 'empenhado' || field === 'liquidado' ? parseFloat(novoValor) : parseInt(novoValor);
        }
        
        if (registro.fundo === 'Emendas Federais') {
            const numeroEmenda = document.getElementById('numeroEmenda');
            const parlamentar = document.getElementById('parlamentar');
            const tipo = document.getElementById('tipo');
            
            if (numeroEmenda && numeroEmenda.value) dadosAtualizacao.numeroEmenda = numeroEmenda.value;
            if (parlamentar && parlamentar.value) dadosAtualizacao.parlamentar = parlamentar.value;
            if (tipo && tipo.value) dadosAtualizacao.tipo = tipo.value;
        }
        
        const resultado = await atualizarDado(docId, dadosAtualizacao);
        
        if (resultado.sucesso) {
            await carregarDadosDoFirebase();
            document.body.removeChild(overlay);
        } else {
            alert(resultado.mensagem);
        }
    } catch (error) {
        console.error('Erro ao salvar edição:', error);
        alert('Ocorreu um erro ao salvar. Por favor, tente novamente.');
    }
}

function mostrarFormularioNovoRegistro() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center';
    document.body.appendChild(overlay);
    
    const form = document.createElement('div');
    form.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto';
    
    form.innerHTML = `
        <h4 class="text-xl font-semibold mb-4">Novo Registro</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                <select id="novo-ano" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="2019">2019</option>
                    <option value="2020">2020</option>
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024" selected>2024</option>
                    <option value="2025">2025</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Fundo</label>
                <select id="novo-fundo" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="FUSP">FUSP</option>
                    <option value="FECAM">FECAM</option>
                    <option value="Emendas Estaduais">Emendas Estaduais</option>
                    <option value="Emendas Federais">Emendas Federais</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Eixo Temático</label>
                <select id="novo-eixo" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="EVM">EVM</option>
                    <option value="VPSP-MQVPSP">VPSP-MQVPSP</option>
                    <option value="ECV-FISPDS-RMVI">ECV-FISPDS-RMVI</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Natureza da Despesa</label>
                <select id="novo-natureza" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Custeio">Custeio</option>
                    <option value="Investimento">Investimento</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Valor Empenhado</label>
                <input type="number" id="novo-empenhado" value="0" step="0.01" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Valor Liquidado</label>
                <input type="number" id="novo-liquidado" value="0" step="0.01" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Objetos Adquiridos</label>
                <input type="number" id="novo-objetos" value="0" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Contas Prestadas</label>
                <input type="number" id="novo-prestadas" value="0" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
        </div>
        
        <div id="campos-emendas-federais" class="hidden mt-4 p-4 bg-purple-50 rounded-lg">
            <h5 class="font-medium mb-2">Campos Extras - Emendas Federais</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="novo-numeroEmenda" placeholder="Número da Emenda" class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <input type="text" id="novo-parlamentar" placeholder="Parlamentar" class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <select id="novo-tipo" class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="">Tipo</option>
                    <option value="RP6">RP6</option>
                    <option value="RP7">RP7</option>
                </select>
                <input type="number" id="novo-valorVinculado" placeholder="Valor Vinculado" step="0.01" class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
        </div>
        
        <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Lista de Objetos</label>
            <div id="novo-items-container" class="space-y-2">
                <div class="flex items-center space-x-2">
                    <input type="text" value="" class="novo-item-input flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button type="button" class="remove-item bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <button type="button" id="novo-add-item" class="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg">
                <i class="fas fa-plus"></i> Adicionar Item
            </button>
        </div>
        
        <div class="flex justify-end space-x-2 mt-6">
            <button type="button" id="novo-cancel" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">
                Cancelar
            </button>
            <button type="button" id="novo-save" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Salvar
            </button>
        </div>
    `;
    
    overlay.appendChild(form);
    
    document.getElementById('novo-fundo').addEventListener('change', function() {
        const camposExtras = document.getElementById('campos-emendas-federais');
        if (this.value === 'Emendas Federais') {
            camposExtras.classList.remove('hidden');
        } else {
            camposExtras.classList.add('hidden');
        }
    });
    
    document.getElementById('novo-cancel').addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    
    document.getElementById('novo-save').addEventListener('click', function() {
        salvarNovoRegistro(overlay);
    });
    
    document.getElementById('novo-add-item').addEventListener('click', function() {
        const container = document.getElementById('novo-items-container');
        const newItemGroup = document.createElement('div');
        newItemGroup.className = 'flex items-center space-x-2';
        newItemGroup.innerHTML = `
            <input type="text" value="" class="novo-item-input flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button type="button" class="remove-item bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(newItemGroup);
        
        newItemGroup.querySelector('.remove-item').addEventListener('click', function() {
            container.removeChild(newItemGroup);
        });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemGroup = this.parentNode;
            itemGroup.parentNode.removeChild(itemGroup);
        });
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

async function salvarNovoRegistro(overlay) {
    try {
        const ano = parseInt(document.getElementById('novo-ano').value);
        const fundo = document.getElementById('novo-fundo').value;
        const eixo = document.getElementById('novo-eixo').value;
        const natureza = document.getElementById('novo-natureza').value;
        const empenhado = parseFloat(document.getElementById('novo-empenhado').value || 0);
        const liquidado = parseFloat(document.getElementById('novo-liquidado').value || 0);
        const objetos = parseInt(document.getElementById('novo-objetos').value || 0);
        const prestadas = parseInt(document.getElementById('novo-prestadas').value || 0);
        
        const itemInputs = document.querySelectorAll('.novo-item-input');
        const itens = Array.from(itemInputs).map(input => input.value).filter(val => val.trim() !== '');
        
        const dados = {
            ano,
            fundo,
            eixo,
            natureza,
            empenhado,
            liquidado,
            objetos,
            prestadas,
            itens
        };
        
        if (fundo === 'Emendas Federais') {
            const numeroEmenda = document.getElementById('novo-numeroEmenda').value;
            const parlamentar = document.getElementById('novo-parlamentar').value;
            const tipo = document.getElementById('novo-tipo').value;
            const valorVinculado = parseFloat(document.getElementById('novo-valorVinculado').value || 0);
            
            if (numeroEmenda) dados.numeroEmenda = numeroEmenda;
            if (parlamentar) dados.parlamentar = parlamentar;
            if (tipo) dados.tipo = tipo;
            if (valorVinculado) dados.valorVinculado = valorVinculado;
        }
        
        const resultado = await criarRegistro(dados);
        
        if (resultado.sucesso) {
            await carregarDadosDoFirebase();
            document.body.removeChild(overlay);
            alert('Registro criado com sucesso!');
        } else {
            alert(resultado.mensagem);
        }
    } catch (error) {
        console.error('Erro ao criar registro:', error);
        alert('Ocorreu um erro ao criar o registro. Por favor, tente novamente.');
    }
}

async function migrarDadosOriginais() {
    try {
        const dadosFECAMeEmendas = [
            {ano: 2022, fundo: "FECAM", eixo: "EVM", natureza: "Investimento", empenhado: 173300, liquidado: 173300, objetos: 1733, prestadas: 1733, itens: ["ABAFADOR DE INCÊNCIO"], previsao: 173300, homologado: 173300, saldo: 0},
            {ano: 2022, fundo: "FECAM", eixo: "EVM", natureza: "Investimento", empenhado: 7700370, liquidado: 7700370, objetos: 11066, prestadas: 11066, itens: ["CAPACETE DE SALVAMENTO"], previsao: 8804037.83, homologado: 8797470, saldo: 1103667.83},
            {ano: 2022, fundo: "FECAM", eixo: "EVM", natureza: "Investimento", empenhado: 6720000, liquidado: 6720000, objetos: 3, prestadas: 3, itens: ["AUTO TANQUE"], previsao: 6720000, homologado: 6720000, saldo: 0},
            {ano: 2022, fundo: "FECAM", eixo: "EVM", natureza: "Investimento", empenhado: 953000, liquidado: 953000, objetos: 4, prestadas: 4, itens: ["BAMBI BUCKET"], previsao: 953000, homologado: 953000, saldo: 0},
            {ano: 2022, fundo: "FECAM", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 50, prestadas: 0, itens: ["SOPRADOR COSTAL"], previsao: 117865, homologado: 99495, saldo: 117865},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "201", autor: "Giselle Monteiro", valor: 559802, upu: "16010-SEDEC", uo: "16010-SEDEC", nomeEmenda: "AQUISIÇÃO DE MATERIAIS E EQUIPAMENTOS PARA A DEFESA CIVIL", situacao: "devolvido para SEPLAG, orientado troca para capacete de incêndio (SEI-270042/001421/2022)"},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "1069", autor: "Prof. Josemar", valor: 80000, upu: "16010-SEDEC", uo: "16610-FUNESBOM", nomeEmenda: "AQUISIÇÃO DE MATERIAIS PARA O CBMERJ", situacao: "devolvido para SEPLAG, orientado troca para capacete de incêndio (SEI-270042/001421/2022)"},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "1387", autor: "Martha Rocha", valor: 240000, upu: "16010-SEDEC", uo: "16610-FUNESBOM", nomeEmenda: "COMPRA DE TANQUES FLEXÍVEIS (2)", situacao: "devolvido para SEPLAG, orientado troca de GD de 33 para 44 e do objeto para capacete de incêndio (SEI-270042/001421/2022)"},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "2349", autor: "Luiz Paulo", valor: 88200, upu: "16010-SEDEC", uo: "16010-SEDEC", nomeEmenda: "COMPRA DE 42 UNIDADES DE BARRACA TIPO TENDA PANTOGRÁFICA", situacao: "devolvido para SEPLAG, orientado não afixar o quantitativo de barracas devido ao valor ter sido reduzido no pregão"},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "2359", autor: "Luiz Paulo", valor: 80000, upu: "16010-SEDEC", uo: "16610-FUNESBOM", nomeEmenda: "COMPRA DE UMA UNIDADE REBOCÁVEL DE ILUMINAÇÃO", situacao: "devolvido para SEPLAG, orientado troca para capacete de incêndio (SEI-270042/001421/2022)"},
            {ano: 2022, fundo: "Emendas Estaduais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: [], numeroEmenda: "2735", autor: "Tia Ju", valor: 150000, upu: "16010-SEDEC", uo: "16610-FUNESBOM", nomeEmenda: "REFORÇO PARA O REEQUIPAMENTO DO CORPO DE BOMBEIROS MILITAR DO ESTADO DO ESTADO DO RIO DE JANEIRO", situacao: "retornou para a SUAD, aguardando término de processo licitatorio para solicitar consumo"},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 8209869.52, liquidado: 8209869.52, objetos: 1, prestadas: 1, itens: ["01 - AEM"], numeroEmenda: "71200005", parlamentar: "BANCADA RJ", tipo: "RP7", valorEmenda: 9359254.30, valorUnitarioEstimado: 4500000, valorUnitarioHomologado: 8209869.52, ma: 30, previsao: 4500000, homologado: 8209869.52},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 - APM"], numeroEmenda: "71200005", parlamentar: "BANCADA RJ", tipo: "RP7", valorEmenda: 9359254.30, valorUnitarioEstimado: 5059254.30, valorUnitarioHomologado: 6576000, ma: 30, previsao: 5059254.30, homologado: 6576000},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 27, prestadas: 0, itens: ["27 Capacetes de Voo (GOA)"], numeroEmenda: "30580003", parlamentar: "Dep Fed Cabo Daciolo", tipo: "RP6", valorEmenda: 542443.05, valorUnitarioEstimado: 25814.67, ma: 30, previsao: 567922.74, homologado: 0},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1284, prestadas: 0, itens: ["1284 Gorros Australianos (GMar)"], numeroEmenda: "30580003", parlamentar: "Dep Fed Cabo Daciolo", tipo: "RP6", valorEmenda: 542443.05, valorUnitarioEstimado: 27.83, ma: 30, previsao: 35733.72, homologado: 0},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 30, prestadas: 0, itens: ["30 Sopradores de combate a incêndio florestal"], numeroEmenda: "30780009", parlamentar: "Dep Fed Christiane Brasil", tipo: "RP6", valorEmenda: 500000, valorUnitarioEstimado: 3511.66, ma: 30, previsao: 98326.48, homologado: 0},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 3, prestadas: 0, itens: ["03 viaturas Auto Socorro de Emergência"], numeroEmenda: "37650012", parlamentar: "Dep Fed Soraya Santos", tipo: "RP6", valorEmenda: 500000, valorUnitarioEstimado: 175466.67, ma: 30, previsao: 701866.68, homologado: 0},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 7, prestadas: 0, itens: ["07 Motos Aquáticas 1100 cc"], numeroEmenda: "14730010", parlamentar: "Dep Fed Deley", tipo: "RP6", valorEmenda: 400000, valorUnitarioEstimado: 82810.86, ma: 30, previsao: 579676, homologado: 0},
            {ano: 2019, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 botes infláveis com casco semirrígido"], numeroEmenda: "27890002", parlamentar: "Dep Fed Sergio Sveyter", tipo: "RP6", valorEmenda: 1132880, valorUnitarioEstimado: 578000, ma: 30, previsao: 1156000, homologado: 0},
            {ano: 2020, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 503400, liquidado: 503400, objetos: 120, prestadas: 120, itens: ["120 Geradores"], numeroEmenda: "41520003", parlamentar: "Dep Fed Jorge Braz", tipo: "RP6", valorEmenda: 690765.26, valorUnitarioEstimado: 4850.67, valorUnitarioHomologado: 4195, ma: 30, previsao: 609049.20, homologado: 503400},
            {ano: 2020, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 439670.53, liquidado: 439670.53, objetos: 299, prestadas: 299, itens: ["299 Motobomba portátil"], numeroEmenda: "37560007", parlamentar: "Dep Fed Rosangela Gomes", tipo: "RP6", valorEmenda: 200000, valorUnitarioEstimado: 1116.96, valorUnitarioHomologado: 1470.47, ma: 30, previsao: 428972.31, homologado: 439670.53},
            {ano: 2021, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 428504.13, liquidado: 428504.13, objetos: 3, prestadas: 3, itens: ["03 Desencarceradores com kit Concreto"], numeroEmenda: "41020020", parlamentar: "Dep Fed Helio Lopes", tipo: "RP6", valorEmenda: 820038, valorUnitarioEstimado: 268730, valorUnitarioHomologado: 143128.68, ma: 30, previsao: 429386.04, homologado: 2460114},
            {ano: 2021, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 1189572.44, liquidado: 1189572.44, objetos: 7, prestadas: 7, itens: ["07 Moto Aquáticas com Reboque"], numeroEmenda: "41150003", parlamentar: "Dep Fed Maj Fabiana", tipo: "RP6", valorEmenda: 584000, valorUnitarioEstimado: 813270, valorUnitarioHomologado: 169938.92, ma: 30, previsao: 1189572.51, homologado: 1189572.44},
            {ano: 2022, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 Sistema de Cascata de Ar Comprimido"], numeroEmenda: "39560007", parlamentar: "Dep Fed Del Antônio Furtado", tipo: "RP6", valorEmenda: 500000, valorUnitarioEstimado: 277333.34, valorUnitarioHomologado: 291000, ma: 30, previsao: 554666.67, homologado: 582000},
            {ano: 2023, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 3, prestadas: 0, itens: ["03 viaturas descaracterizadas (Chronos)"], numeroEmenda: "38610014", parlamentar: "Dep Fed Lourival", tipo: "RP6", valorEmenda: 358426, valorUnitarioEstimado: 115435.99, valorUnitarioHomologado: 115435.99, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 50, prestadas: 0, itens: ["50 kit mergulho"], numeroEmenda: "42100014", parlamentar: "Sen Carlos Portinho", tipo: "RP6", valorEmenda: 845000, valorUnitarioEstimado: 1582.70, valorUnitarioHomologado: 1582.70, ma: 30, previsao: 79135, homologado: 79135},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["1 SUV APC"], numeroEmenda: "42100014", parlamentar: "Sen Carlos Portinho", tipo: "RP6", valorEmenda: 845000, valorUnitarioEstimado: 397000, valorUnitarioHomologado: 397000, ma: 30, previsao: 397000, homologado: 397000},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 botes"], numeroEmenda: "42100014", parlamentar: "Sen Carlos Portinho", tipo: "RP6", valorEmenda: 845000, valorUnitarioEstimado: 158894.17, valorUnitarioHomologado: 158894.17, ma: 30, previsao: 317788.34, homologado: 317788.34},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 50, prestadas: 0, itens: ["50 Tendas pantograficas"], numeroEmenda: "42100014", parlamentar: "Sen Carlos Portinho", tipo: "RP6", valorEmenda: 845000, valorUnitarioEstimado: 2026, ma: 30, previsao: 101300, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 SUV APC"], numeroEmenda: "43510006", parlamentar: "Dep Fed Ramagem", tipo: "RP6", valorEmenda: 1200000, valorUnitarioEstimado: 397000, valorUnitarioHomologado: 397000, ma: 30, previsao: 794000, homologado: 794000},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 3, prestadas: 0, itens: ["03 botes ( ATA CBMERJ)"], numeroEmenda: "43510006", parlamentar: "Dep Fed Ramagem", tipo: "RP6", valorEmenda: 1200000, valorUnitarioEstimado: 158894.17, valorUnitarioHomologado: 158894.17, ma: 30, previsao: 476682.51, homologado: 476682.51},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 16, prestadas: 0, itens: ["16 Tendas Pantográficas"], numeroEmenda: "43510006", parlamentar: "Dep Fed Ramagem", tipo: "RP6", valorEmenda: 1200000, valorUnitarioEstimado: 2028, ma: 30, previsao: 32448, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 13, prestadas: 0, itens: ["13 Drones I + 13 Baterias"], numeroEmenda: "9219003", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 1014000, valorUnitarioEstimado: 37750, ma: 30, previsao: 490750, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 Drones II"], numeroEmenda: "9219003", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 1014000, valorUnitarioEstimado: 249120, valorUnitarioHomologado: 142620, ma: 30, previsao: 498240, homologado: 285240},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 3, prestadas: 0, itens: ["03 Drones III"], numeroEmenda: "9219003", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 1014000, valorUnitarioEstimado: 42755.06, valorUnitarioHomologado: 42755.06, ma: 30, previsao: 128265.18, homologado: 128265.18},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 ABS"], numeroEmenda: "71200009", parlamentar: "Dep Fed Delegado Ramagem", tipo: "RP7", valorEmenda: 2000000, valorUnitarioEstimado: 2590000, valorUnitarioHomologado: 2590000, ma: 30, previsao: 2590000, homologado: 2590000},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 Caminhonetes 4X4 descaracterizadas"], numeroEmenda: "92190002", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 273814.36, valorUnitarioEstimado: 239060.36, valorUnitarioHomologado: 239060.36, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 DRONE com kit bateria"], numeroEmenda: "92190002", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 273814.36, valorUnitarioEstimado: 33154, valorUnitarioHomologado: 33154, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 3, prestadas: 0, itens: ["03 Caminhonetes 4X4 descaracterizadas"], numeroEmenda: "92190005", parlamentar: "Sen Flavio Bolsonaro", tipo: "RP6", valorEmenda: 717181.08, valorUnitarioEstimado: 239060.36, valorUnitarioHomologado: 239060.36, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 moto aquatica com carreta"], numeroEmenda: "43800006", parlamentar: "Dep Fed General Pazuelo", tipo: "RP6", valorEmenda: 323597, valorUnitarioEstimado: 119399, valorUnitarioHomologado: 119399, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 carreta de transporte rodoviário"], numeroEmenda: "43800006", parlamentar: "Dep Fed General Pazuelo", tipo: "RP6", valorEmenda: 323597, valorUnitarioEstimado: 9798, valorUnitarioHomologado: 9798, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 6, prestadas: 0, itens: ["06 EPR"], numeroEmenda: "43800006", parlamentar: "Dep Fed General Pazuelo", tipo: "RP6", valorEmenda: 323597, valorUnitarioEstimado: 32400, valorUnitarioHomologado: 32400, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 2, prestadas: 0, itens: ["02 caminhonetes 4x4 caracterizadas para treinamento"], numeroEmenda: "71200009", parlamentar: "Dep Fed Roberto Monteiro", tipo: "RP7", valorEmenda: 700000, valorUnitarioEstimado: 273500, valorUnitarioHomologado: 254933, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 Hatch descaracterizado de apoio opercional de uso reservado"], numeroEmenda: "71200009", parlamentar: "Dep Fed Roberto Monteiro", tipo: "RP7", valorEmenda: 700000, valorUnitarioEstimado: 129459.36, valorUnitarioHomologado: 129459.36, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 6, prestadas: 0, itens: ["06 notebooks"], numeroEmenda: "71200009", parlamentar: "Dep Fed Roberto Monteiro", tipo: "RP7", valorEmenda: 700000, valorUnitarioEstimado: 3790, valorUnitarioHomologado: 3790, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 Camioneta/suv 4x4 caracterizada - canil"], numeroEmenda: "71200009", parlamentar: "Dep Fed Sgt Portugal", tipo: "RP7", valorEmenda: 1000000, valorUnitarioEstimado: 312990, valorUnitarioHomologado: 312990, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 caminhao VUC descaracterizado ( veiculo urbano de carga)"], numeroEmenda: "71200009", parlamentar: "Dep Fed Sgt Portugal", tipo: "RP7", valorEmenda: 1000000, valorUnitarioEstimado: 477400, valorUnitarioHomologado: 477400, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 21, prestadas: 0, itens: ["21 notebooks"], numeroEmenda: "71200009", parlamentar: "Dep Fed Sgt Portugal", tipo: "RP7", valorEmenda: 1000000, valorUnitarioEstimado: 3790, valorUnitarioHomologado: 3790, ma: 90, previsao: 0, homologado: 0},
            {ano: 2024, fundo: "Emendas Federais", eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 1, prestadas: 0, itens: ["01 Hatch descaracterizado de apoio operacional de uso reservado"], numeroEmenda: "71200009", parlamentar: "Dep Fed Sgt Portugal", tipo: "RP7", valorEmenda: 1000000, valorUnitarioEstimado: 129459.36, valorUnitarioHomologado: 129459.36, ma: 90, previsao: 0, homologado: 0}
        ];
        
        const resultado = await migrarDadosIniciais(dadosFECAMeEmendas);
        
        if (resultado.sucesso) {
            alert('Dados do FECAM e Emendas migrados com sucesso! Dados do FUSP mantidos intactos.');
            await carregarDadosDoFirebase();
        } else {
            alert(resultado.mensagem);
        }
    } catch (error) {
        console.error('Erro ao migrar dados:', error);
        alert('Ocorreu um erro ao migrar os dados. Por favor, tente novamente.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const autenticado = await verificarAutenticacao();
    
    if (!autenticado) {
        document.getElementById('loginModal').classList.remove('hidden');
    } else {
        await carregarDadosDoFirebase();
        document.getElementById('logoutBtn').classList.remove('hidden');
    }
    
    document.getElementById('btnQuantidade').addEventListener('change', () => {
        visualizacaoAtual = 'quantidade';
        atualizarVisualizacao();
    });
    
    document.getElementById('btnObjetos').addEventListener('change', () => {
        visualizacaoAtual = 'objetos';
        atualizarVisualizacao();
    });
    
    document.getElementById('btnAplicarFiltro').addEventListener('click', () => {
        filtrosAtuais.ano = document.getElementById('filtroAno').value;
        filtrosAtuais.eixo = document.getElementById('filtroEixo').value;
        filtrosAtuais.natureza = document.getElementById('filtroNatureza').value;
        atualizarFundosSelecionados();
        atualizarVisualizacao();
        
        if (abaAtual !== 'geral') {
            window.atualizarAbaFundo(abaAtual);
        }
    });
    
    document.querySelectorAll('[id^="filtro"][type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            atualizarFundosSelecionados();
            atualizarVisualizacao();
            
            if (abaAtual !== 'geral') {
                window.atualizarAbaFundo(abaAtual);
            }
        });
    });
    
    document.getElementById('btnNovoRegistro').addEventListener('click', () => {
        mostrarFormularioNovoRegistro();
    });
    
    document.getElementById('btnMigrarDados').addEventListener('click', () => {
        if (confirm('Esta operação vai migrar os dados originais para o Firebase. Deseja continuar?')) {
            migrarDadosOriginais();
        }
    });
    
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const resultado = await fazerLogin(email, password);
        
        if (resultado.sucesso) {
            document.getElementById('loginModal').classList.add('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            await carregarDadosDoFirebase();
        } else {
            document.getElementById('loginError').textContent = resultado.mensagem;
        }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fazerLogout();
        location.reload();
    });
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('border-blue-500', 'text-blue-600');
                btn.classList.add('border-transparent', 'text-gray-500');
            });
            
            this.classList.remove('border-transparent', 'text-gray-500');
            this.classList.add('border-blue-500', 'text-blue-600');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            document.getElementById(`tab-content-${tab}`).classList.remove('hidden');
            
            abaAtual = tab;
            
            if (tab !== 'geral') {
                window.atualizarAbaFundo(tab);
            }
        });
    });
});

window.dadosResumo = dadosResumo;
window.visualizacaoAtual = visualizacaoAtual;
window.filtrosAtuais = filtrosAtuais;
window.formatarMoeda = formatarMoeda;
window.formatarNumero = formatarNumero;