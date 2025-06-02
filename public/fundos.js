function criarVisualizacaoFundo(fundo, containerId) {
    const container = document.getElementById(containerId);
    const fundoNormalizado = fundo.replace(/\s+/g, '-').toLowerCase();
    
    const corFundo = {
        'fusp': 'blue',
        'fecam': 'green',
        'emendas-estaduais': 'yellow',
        'emendas-federais': 'purple'
    }[fundoNormalizado];
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-${corFundo}-800 text-white rounded-lg p-6 shadow-lg">
                <div class="text-sm opacity-90">Total Empenhado - ${fundo}</div>
                <div class="text-2xl font-bold mt-2" id="${fundoNormalizado}-empenhado">R$ 0,00</div>
            </div>
            
            <div class="bg-${corFundo}-600 text-white rounded-lg p-6 shadow-lg">
                <div class="text-sm opacity-90">Total Liquidado - ${fundo}</div>
                <div class="text-2xl font-bold mt-2" id="${fundoNormalizado}-liquidado">R$ 0,00</div>
            </div>
            
            <div class="bg-${corFundo}-500 text-white rounded-lg p-6 shadow-lg">
                <div class="text-sm opacity-90">Objetos Adquiridos - ${fundo}</div>
                <div class="text-2xl font-bold mt-2" id="${fundoNormalizado}-objetos">0</div>
            </div>
            
            <div class="bg-${corFundo}-700 text-white rounded-lg p-6 shadow-lg">
                <div class="text-sm opacity-90">Contas Prestadas - ${fundo}</div>
                <div class="text-2xl font-bold mt-2" id="${fundoNormalizado}-prestadas">0</div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow-md mb-6">
            <div class="bg-${corFundo}-900 text-white p-4 rounded-t-lg">
                <h2 class="text-lg font-semibold">Dados ${fundo}</h2>
            </div>
            <div class="p-4">
                <div class="overflow-x-auto">
                    <table class="w-full table-auto">
                        <thead>
                            <tr class="bg-${corFundo}-700 text-white">
                                <th class="px-4 py-2 text-left">Ano</th>
                                <th class="px-4 py-2 text-left">Eixo</th>
                                <th class="px-4 py-2 text-left">Natureza</th>
                                <th class="px-4 py-2 text-left">Empenhado</th>
                                <th class="px-4 py-2 text-left">Liquidado</th>
                                <th class="px-4 py-2 text-left" id="${fundoNormalizado}-colObjetos">Objetos</th>
                                <th class="px-4 py-2 text-left">Contas Prestadas</th>
                                ${fundo === 'Emendas Federais' ? '<th class="px-4 py-2 text-left">Informações</th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="${fundoNormalizado}-tabela" class="divide-y divide-gray-200">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Distribuição por Eixo - ${fundo}</h3>
                <div class="chart-container">
                    <canvas id="${fundoNormalizado}-eixoChart"></canvas>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Evolução por Ano - ${fundo}</h3>
                <div class="chart-container">
                    <canvas id="${fundoNormalizado}-anoChart"></canvas>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Por Natureza - ${fundo}</h3>
                <div class="chart-container">
                    <canvas id="${fundoNormalizado}-naturezaChart"></canvas>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Objetos vs Prestadas - ${fundo}</h3>
                <div class="chart-container">
                    <canvas id="${fundoNormalizado}-objetosChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

const chartsIndividuais = {};

function atualizarAbaFundo(tab) {
    const fundoMap = {
        'fusp': 'FUSP',
        'fecam': 'FECAM',
        'emendas-estaduais': 'Emendas Estaduais',
        'emendas-federais': 'Emendas Federais'
    };
    
    const fundo = fundoMap[tab];
    
    if (!fundo) return;
    
    if (!document.getElementById(`${tab}-empenhado`)) {
        criarVisualizacaoFundo(fundo, `tab-content-${tab}`);
    }
    
    const dadosFundo = window.dadosResumo.filter(d => {
        return d.fundo === fundo &&
               (window.filtrosAtuais.ano === 'todos' || d.ano.toString() === window.filtrosAtuais.ano) &&
               (window.filtrosAtuais.eixo === 'todos' || d.eixo === window.filtrosAtuais.eixo) &&
               (window.filtrosAtuais.natureza === 'todos' || d.natureza === window.filtrosAtuais.natureza);
    });
    
    const totais = dadosFundo.reduce((acc, d) => {
        acc.empenhado += d.empenhado;
        acc.liquidado += d.liquidado;
        acc.objetos += d.objetos;
        acc.prestadas += d.prestadas;
        return acc;
    }, { empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0 });
    
    const todosItens = new Set();
    dadosFundo.forEach(d => {
        if (d.itens) {
            d.itens.forEach(item => todosItens.add(item));
        }
    });
    
    document.getElementById(`${tab}-empenhado`).textContent = window.formatarMoeda(totais.empenhado);
    document.getElementById(`${tab}-liquidado`).textContent = window.formatarMoeda(totais.liquidado);
    
    if (window.visualizacaoAtual === 'quantidade') {
        document.getElementById(`${tab}-objetos`).textContent = window.formatarNumero(totais.objetos);
    } else {
        document.getElementById(`${tab}-objetos`).textContent = window.formatarNumero(todosItens.size);
    }
    
    document.getElementById(`${tab}-prestadas`).textContent = window.formatarNumero(totais.prestadas);
    
    const tbody = document.getElementById(`${tab}-tabela`);
    tbody.innerHTML = '';
    
    const colObjetos = document.getElementById(`${tab}-colObjetos`);
    colObjetos.textContent = window.visualizacaoAtual === 'quantidade' ? 'Objetos Adquiridos' : 'Lista de Objetos';
    
    dadosFundo.sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        if (a.eixo !== b.eixo) return a.eixo.localeCompare(b.eixo);
        return a.natureza.localeCompare(b.natureza);
    });
    
    dadosFundo.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        let objetosCell;
        if (window.visualizacaoAtual === 'quantidade') {
            objetosCell = window.formatarNumero(d.objetos);
        } else {
            if (d.itens && d.itens.length > 0) {
                objetosCell = `<div class="flex flex-wrap gap-1">
                    ${d.itens.map(item => `<span class="inline-block bg-${tab === 'fusp' ? 'blue' : tab === 'fecam' ? 'green' : tab === 'emendas-estaduais' ? 'yellow' : 'purple'}-600 text-white text-xs px-2 py-1 rounded-full">${item}</span>`).join('')}
                </div>`;
            } else {
                objetosCell = '-';
            }
        }
        
        let infoExtra = '';
        if (fundo === 'Emendas Federais') {
            infoExtra = `<td class="px-4 py-2 text-xs">
                ${d.numeroEmenda ? `<div>Emenda: ${d.numeroEmenda}</div>` : ''}
                ${d.parlamentar ? `<div>Parlamentar: ${d.parlamentar}</div>` : ''}
                ${d.tipo ? `<div>Tipo: ${d.tipo}</div>` : ''}
            </td>`;
        }
        
        tr.innerHTML = `
            <td class="px-4 py-2">${d.ano}</td>
            <td class="px-4 py-2">${d.eixo}</td>
            <td class="px-4 py-2">${d.natureza}</td>
            <td class="px-4 py-2">${window.formatarMoeda(d.empenhado)}</td>
            <td class="px-4 py-2">${window.formatarMoeda(d.liquidado)}</td>
            <td class="px-4 py-2">${objetosCell}</td>
            <td class="px-4 py-2">${window.formatarNumero(d.prestadas)}</td>
            ${infoExtra}
        `;
        
        tbody.appendChild(tr);
    });
    
    if (dadosFundo.length > 0) {
        const trTotal = document.createElement('tr');
        trTotal.className = 'font-bold bg-gray-100';
        
        let objetosTotaisCell;
        if (window.visualizacaoAtual === 'quantidade') {
            objetosTotaisCell = window.formatarNumero(totais.objetos);
        } else {
            objetosTotaisCell = `<strong>${todosItens.size} tipos</strong>`;
        }
        
        trTotal.innerHTML = `
            <td colspan="3" class="px-4 py-2">TOTAL</td>
            <td class="px-4 py-2">${window.formatarMoeda(totais.empenhado)}</td>
            <td class="px-4 py-2">${window.formatarMoeda(totais.liquidado)}</td>
            <td class="px-4 py-2">${objetosTotaisCell}</td>
            <td class="px-4 py-2">${window.formatarNumero(totais.prestadas)}</td>
            ${fundo === 'Emendas Federais' ? '<td></td>' : ''}
        `;
        tbody.appendChild(trTotal);
    }
    
    atualizarGraficosFundo(tab, dadosFundo);
}

function atualizarGraficosFundo(tab, dadosFundo) {
    const cor = {
        'fusp': 'rgba(59, 130, 246, 0.8)',
        'fecam': 'rgba(34, 197, 94, 0.8)',
        'emendas-estaduais': 'rgba(251, 191, 36, 0.8)',
        'emendas-federais': 'rgba(168, 85, 247, 0.8)'
    }[tab];
    
    const dadosEixo = {
        labels: ['EVM', 'VPSP-MQVPSP', 'ECV-FISPDS-RMVI'],
        datasets: [{
            label: 'Empenhado',
            data: [
                dadosFundo.filter(d => d.eixo === 'EVM').reduce((sum, d) => sum + d.empenhado, 0),
                dadosFundo.filter(d => d.eixo === 'VPSP-MQVPSP').reduce((sum, d) => sum + d.empenhado, 0),
                dadosFundo.filter(d => d.eixo === 'ECV-FISPDS-RMVI').reduce((sum, d) => sum + d.empenhado, 0)
            ],
            backgroundColor: cor,
            borderWidth: 1
        }]
    };
    
    const anos = [2019, 2020, 2021, 2022, 2023, 2024];
    const dadosAno = {
        labels: anos,
        datasets: [{
            label: 'Evolução Anual',
            data: anos.map(ano => dadosFundo.filter(d => d.ano === ano).reduce((sum, d) => sum + d.empenhado, 0)),
            backgroundColor: cor,
            borderColor: cor,
            borderWidth: 2,
            fill: false
        }]
    };
    
    const dadosNatureza = {
        labels: ['Custeio', 'Investimento'],
        datasets: [{
            label: 'Por Natureza',
            data: [
                dadosFundo.filter(d => d.natureza === 'Custeio').reduce((sum, d) => sum + d.empenhado, 0),
                dadosFundo.filter(d => d.natureza === 'Investimento').reduce((sum, d) => sum + d.empenhado, 0)
            ],
            backgroundColor: [cor, cor.replace('0.8', '0.5')],
            borderWidth: 1
        }]
    };
    
    let objetosData, prestadasData;
    
    if (window.visualizacaoAtual === 'quantidade') {
        objetosData = anos.map(ano => dadosFundo.filter(d => d.ano === ano).reduce((sum, d) => sum + d.objetos, 0));
        prestadasData = anos.map(ano => dadosFundo.filter(d => d.ano === ano).reduce((sum, d) => sum + d.prestadas, 0));
    } else {
        objetosData = anos.map(ano => {
            const itensUnicos = new Set();
            dadosFundo.filter(d => d.ano === ano).forEach(d => {
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
                label: 'Objetos',
                data: objetosData,
                backgroundColor: cor,
                borderWidth: 1
            },
            {
                label: 'Prestadas',
                data: prestadasData,
                backgroundColor: cor.replace('0.8', '0.5'),
                borderWidth: 1
            }
        ]
    };
    
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
                            label += window.formatarMoeda(context.parsed.y);
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
                            label += window.formatarNumero(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };
    
    if (chartsIndividuais[tab]) {
        Object.values(chartsIndividuais[tab]).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
    
    chartsIndividuais[tab] = {};
    
    chartsIndividuais[tab].eixo = new Chart(document.getElementById(`${tab}-eixoChart`), {
        type: 'bar',
        data: dadosEixo,
        options: opcoes
    });
    
    chartsIndividuais[tab].ano = new Chart(document.getElementById(`${tab}-anoChart`), {
        type: 'line',
        data: dadosAno,
        options: opcoes
    });
    
    chartsIndividuais[tab].natureza = new Chart(document.getElementById(`${tab}-naturezaChart`), {
        type: 'pie',
        data: dadosNatureza,
        options: opcoes
    });
    
    chartsIndividuais[tab].objetos = new Chart(document.getElementById(`${tab}-objetosChart`), {
        type: 'bar',
        data: dadosObjetos,
        options: opcoesObjetos
    });
}

window.atualizarAbaFundo = atualizarAbaFundo;