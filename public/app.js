// Log de inicialização
console.log('Inicializando dashboard orçamentário SUAD...');

// Sobrescrever console.error para mostrar alertas em caso de erros críticos
const originalConsoleError = console.error;
console.error = function() {
    // Chamar a função original
    originalConsoleError.apply(console, arguments);
    
    // Converter argumentos para string para verificação
    const errorStr = Array.from(arguments).join(' ');
    
    // Detectar erros críticos específicos
    if (
        errorStr.includes('Firebase') ||
        errorStr.includes('firestore') ||
        errorStr.includes('auth') ||
        errorStr.includes('permission')
    ) {
        // Mostrar mensagem de erro na interface para o usuário
        const errorElement = document.createElement('div');
        errorElement.className = 'alert alert-danger alert-dismissible fade show';
        errorElement.setAttribute('role', 'alert');
        errorElement.innerHTML = `
            <strong>Erro:</strong> ${errorStr}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Inserir no início do documento se possível
        if (document.body) {
            const container = document.querySelector('.container-fluid');
            if (container) {
                container.insertBefore(errorElement, container.firstChild);
            } else {
                document.body.insertBefore(errorElement, document.body.firstChild);
            }
        }
    }
};

// Dados da planilha - será substituído pelos dados do Firebase
let dadosResumo = [];

// Estado atual da visualização
let visualizacaoAtual = 'quantidade'; // 'quantidade' ou 'objetos'
let filtrosAtuais = {
    ano: 'todos',
    eixo: 'todos',
    natureza: 'todos'
};

// Referência ao modal de login
let loginModal;

// Referência aos gráficos
let charts = {};

// Funções utilitárias
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

// Função para atualizar a tabela de dados
function atualizarTabela() {
    console.log('Atualizando tabela de dados...');
    const tbody = document.getElementById('tabelaDados');
    if (!tbody) {
        console.error('Elemento tabelaDados não encontrado!');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Filtrar dados conforme os filtros atuais
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza);
    });
    
    // Ordenar dados por ano, eixo e natureza
    dadosFiltrados.sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        if (a.eixo !== b.eixo) return a.eixo.localeCompare(b.eixo);
        return a.natureza.localeCompare(b.natureza);
    });
    
    // Atualizar cabeçalho da coluna de objetos
    const colObjetos = document.getElementById('colObjetos');
    if (colObjetos) {
        colObjetos.textContent = visualizacaoAtual === 'quantidade' ? 'Objetos Adquiridos' : 'Lista de Objetos';
    }
    
    console.log(`Exibindo ${dadosFiltrados.length} registros na tabela`);
    
    // Criar linhas da tabela
    dadosFiltrados.forEach(d => {
        const tr = document.createElement('tr');
        
        // Criar ID único para o documento
        const docId = `${d.ano}_${d.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${d.natureza}`;
        tr.setAttribute('data-id', docId);
        
        // Destaque para linhas com valores zerados
        if (d.empenhado === 0 && d.liquidado === 0) {
            tr.classList.add('text-muted');
        }
        
        // Determinar o conteúdo da célula de objetos com base na visualização atual
        let objetosCell;
        if (visualizacaoAtual === 'quantidade') {
            objetosCell = formatarNumero(d.objetos);
        } else {
            if (d.itens && d.itens.length > 0) {
                objetosCell = `<div class="object-cell"><ul class="object-list">
                    ${d.itens.map(item => `<li class="object-tag">${item}</li>`).join('')}
                </ul></div>`;
            } else {
                objetosCell = '-';
            }
        }
        
        // Criar as células
        tr.innerHTML = `
            <td>${d.ano}</td>
            <td>${d.eixo}</td>
            <td>${d.natureza}</td>
            <td class="editable-cell" data-field="empenhado" data-value="${d.empenhado}">${formatarMoeda(d.empenhado)}</td>
            <td class="editable-cell" data-field="liquidado" data-value="${d.liquidado}">${formatarMoeda(d.liquidado)}</td>
            <td class="editable-cell" data-field="objetos" data-value="${d.objetos}" data-items='${JSON.stringify(d.itens || [])}'>${objetosCell}</td>
            <td class="editable-cell" data-field="prestadas" data-value="${d.prestadas}">${formatarNumero(d.prestadas)}</td>
            <td class="btn-edit-control">
                <button class="btn btn-sm btn-danger btn-excluir" data-id="${docId}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Adicionar event listeners para células editáveis
    document.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', function() {
            mostrarFormularioEdicao(this);
        });
    });
    
    // Adicionar event listeners para botões de excluir
    document.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', function() {
            const docId = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este registro?')) {
                excluirRegistro(docId);
            }
        });
    });
    
    // Adicionar linha de total se houver dados
    if (dadosFiltrados.length > 0) {
        const totais = dadosFiltrados.reduce((acc, d) => {
            acc.empenhado += d.empenhado;
            acc.liquidado += d.liquidado;
            acc.objetos += d.objetos;
            acc.prestadas += d.prestadas;
            return acc;
        }, { empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0 });
        
        // Coletar todos os itens únicos
        const todosItens = new Set();
        dadosFiltrados.forEach(d => {
            if (d.itens) {
                d.itens.forEach(item => todosItens.add(item));
            }
        });
        
        // Determinar o conteúdo da célula de totais de objetos
        let objetosTotaisCell;
        if (visualizacaoAtual === 'quantidade') {
            objetosTotaisCell = formatarNumero(totais.objetos);
        } else {
            objetosTotaisCell = `<strong>${todosItens.size} tipos diferentes</strong>`;
        }
        
        const trTotal = document.createElement('tr');
        trTotal.classList.add('fw-bold', 'bg-light');
        trTotal.innerHTML = `
            <td colspan="3">TOTAL</td>
            <td>${formatarMoeda(totais.empenhado)}</td>
            <td>${formatarMoeda(totais.liquidado)}</td>
            <td>${objetosTotaisCell}</td>
            <td>${formatarNumero(totais.prestadas)}</td>
            <td class="btn-edit-control"></td>
        `;
        tbody.appendChild(trTotal);
    }
    
    console.log('Tabela atualizada com sucesso');
}

// Função para atualizar os cards de resumo
function atualizarResumos() {
    console.log('Atualizando cards de resumo...');
    
    // Filtrar dados conforme os filtros atuais
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza);
    });
    
    // Calcular totais
    const totais = dadosFiltrados.reduce((acc, d) => {
        acc.empenhado += d.empenhado;
        acc.liquidado += d.liquidado;
        acc.objetos += d.objetos;
        acc.prestadas += d.prestadas;
        return acc;
    }, { empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0 });
    
    // Coletar todos os itens únicos para o modo de objetos
    const todosItens = new Set();
    dadosFiltrados.forEach(d => {
        if (d.itens) {
            d.itens.forEach(item => todosItens.add(item));
        }
    });
    
    // Atualizar cards
    const totalEmpenhadoEl = document.getElementById('totalEmpenhado');
    const totalLiquidadoEl = document.getElementById('totalLiquidado');
    const totalObjetosEl = document.getElementById('totalObjetos');
    const totalContasPrestadasEl = document.getElementById('totalContasPrestadas');
    
    if (totalEmpenhadoEl) totalEmpenhadoEl.textContent = formatarMoeda(totais.empenhado);
    if (totalLiquidadoEl) totalLiquidadoEl.textContent = formatarMoeda(totais.liquidado);
    
    if (totalObjetosEl) {
        if (visualizacaoAtual === 'quantidade') {
            totalObjetosEl.textContent = formatarNumero(totais.objetos);
        } else {
            totalObjetosEl.textContent = formatarNumero(todosItens.size);
        }
    }
    
    if (totalContasPrestadasEl) {
        totalContasPrestadasEl.textContent = formatarNumero(totais.prestadas);
    }
    
    console.log('Cards de resumo atualizados com sucesso');
}

// Função para preparar dados para gráficos
function prepararDadosGraficos() {
    console.log('Preparando dados para gráficos...');
    
    // Filtrar dados conforme os filtros atuais
    let dadosFiltrados = dadosResumo.filter(d => {
        return (filtrosAtuais.ano === 'todos' || d.ano.toString() === filtrosAtuais.ano) &&
               (filtrosAtuais.eixo === 'todos' || d.eixo === filtrosAtuais.eixo) &&
               (filtrosAtuais.natureza === 'todos' || d.natureza === filtrosAtuais.natureza);
    });
    
    // Dados para gráfico por eixo temático
    const dadosEixo = {
        labels: ['EVM', 'VPSP-MQVPSP', 'ECV-FISPDS-RMVI'],
        datasets: [
            {
                label: 'Empenhado',
                data: [
                    dadosFiltrados.filter(d => d.eixo === 'EVM').reduce((sum, d) => sum + d.empenhado, 0),
                    dadosFiltrados.filter(d => d.eixo === 'VPSP-MQVPSP').reduce((sum, d) => sum + d.empenhado, 0),
                    dadosFiltrados.filter(d => d.eixo === 'ECV-FISPDS-RMVI').reduce((sum, d) => sum + d.empenhado, 0)
                ],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }
        ]
    };
    
    // Dados para gráfico por ano
    const anos = [2019, 2020, 2021, 2022, 2023, 2024];
    const dadosAno = {
        labels: anos,
        datasets: [
            {
                label: 'Empenhado',
                data: anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.empenhado, 0)),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            },
            {
                label: 'Liquidado',
                data: anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.liquidado, 0)),
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }
        ]
    };
    
    // Dados para gráfico comparativo Empenhado vs Liquidado
    const dadosComparativo = {
        labels: ['Custeio', 'Investimento'],
        datasets: [
            {
                label: 'Empenhado',
                data: [
                    dadosFiltrados.filter(d => d.natureza === 'Custeio').reduce((sum, d) => sum + d.empenhado, 0),
                    dadosFiltrados.filter(d => d.natureza === 'Investimento').reduce((sum, d) => sum + d.empenhado, 0)
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            },
            {
                label: 'Liquidado',
                data: [
                    dadosFiltrados.filter(d => d.natureza === 'Custeio').reduce((sum, d) => sum + d.liquidado, 0),
                    dadosFiltrados.filter(d => d.natureza === 'Investimento').reduce((sum, d) => sum + d.liquidado, 0)
                ],
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }
        ]
    };
    
    // Dados para gráfico objetos vs contas prestadas
    const labelY = visualizacaoAtual === 'quantidade' ? 'Quantidade' : 'Tipos Diferentes';
    
    // Preparar dados para o gráfico de objetos
    let objetosData;
    let prestadasData;
    
    if (visualizacaoAtual === 'quantidade') {
        // Usar contagem de objetos para o modo de quantidade
        objetosData = anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.objetos, 0));
        prestadasData = anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.prestadas, 0));
    } else {
        // Usar contagem de tipos únicos de objetos para o modo de objetos
        objetosData = anos.map(ano => {
            const itensUnicos = new Set();
            dadosFiltrados.filter(d => d.ano === ano).forEach(d => {
                if (d.itens) {
                    d.itens.forEach(item => itensUnicos.add(item));
                }
            });
            return itensUnicos.size;
        });
        
        // Para contas prestadas, usamos a mesma lógica
        prestadasData = anos.map(ano => dadosFiltrados.filter(d => d.ano === ano).reduce((sum, d) => sum + d.prestadas, 0));
    }
    
    const dadosObjetos = {
        labels: anos,
        datasets: [
            {
                label: `${labelY} de Objetos Adquiridos`,
                data: objetosData,
                backgroundColor: 'rgba(255, 206, 86, 0.5)',
                borderColor: 'rgba(255, 206, 86, 1)',
                borderWidth: 1
            },
            {
                label: `${labelY} com Contas Prestadas`,
                data: prestadasData,
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }
        ]
    };
    
    console.log('Dados dos gráficos preparados com sucesso');
    
    return { dadosEixo, dadosAno, dadosComparativo, dadosObjetos };
}

// Função para criar/atualizar gráficos
function atualizarGraficos() {
    console.log('Atualizando gráficos...');
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.error('Chart.js não está disponível. Os gráficos não serão atualizados.');
        return;
    }
    
    const { dadosEixo, dadosAno, dadosComparativo, dadosObjetos } = prepararDadosGraficos();
    
    // Configurações comuns
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
    
    try {
        // Destruir gráficos existentes
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        // Criar novos gráficos
        const eixoChartEl = document.getElementById('eixoChart');
        const anoChartEl = document.getElementById('anoChart');
        const comparativoChartEl = document.getElementById('comparativoChart');
        const objetosChartEl = document.getElementById('objetosChart');
        
        if (eixoChartEl) {
            charts.eixo = new Chart(eixoChartEl, {
                type: 'pie',
                data: dadosEixo,
                options: opcoes
            });
        } else {
            console.warn('Elemento eixoChart não encontrado');
        }
        
        if (anoChartEl) {
            charts.ano = new Chart(anoChartEl, {
                type: 'bar',
                data: dadosAno,
                options: opcoes
            });
        } else {
            console.warn('Elemento anoChart não encontrado');
        }
        
        if (comparativoChartEl) {
            charts.comparativo = new Chart(comparativoChartEl, {
                type: 'bar',
                data: dadosComparativo,
                options: opcoes
            });
        } else {
            console.warn('Elemento comparativoChart não encontrado');
        }
        
        if (objetosChartEl) {
            charts.objetos = new Chart(objetosChartEl, {
                type: 'bar',
                data: dadosObjetos,
                options: opcoesObjetos
            });
        } else {
            console.warn('Elemento objetosChart não encontrado');
        }
        
        console.log('Gráficos atualizados com sucesso');
    } catch (error) {
        console.error('Erro ao criar gráficos:', error);
    }
}

// Atualizar toda a visualização
function atualizarVisualizacao() {
    console.log('Atualizando toda a visualização...');
    try {
        atualizarTabela();
        atualizarResumos();
        atualizarGraficos();
        console.log('Visualização atualizada com sucesso');
    } catch (error) {
        console.error('Erro ao atualizar visualização:', error);
    }
}

// Função para carregar dados do Firebase
async function carregarDadosDoFirebase() {
    console.log('Carregando dados do Firebase...');
    try {
        // Verificar se o objeto firebaseApp está disponível
        if (!window.firebaseApp) {
            throw new Error('O objeto firebaseApp não está disponível. Verifique a inicialização do Firebase.');
        }
        
        const resultado = await window.firebaseApp.carregarDados();
        
        if (resultado.sucesso) {
            console.log(`Dados carregados com sucesso: ${resultado.dados.length} registros`);
            dadosResumo = resultado.dados;
            atualizarVisualizacao();
        } else {
            console.error('Erro ao carregar dados:', resultado.mensagem);
            alert(resultado.mensagem);
        }
    } catch (error) {
        console.error('Erro crítico ao carregar dados:', error);
        alert(`Erro ao carregar dados: ${error.message}`);
    }
}

// Função para mostrar o formulário de edição
function mostrarFormularioEdicao(cell) {
    console.log('Mostrando formulário de edição...');
    
    // Verificar autenticação
    if (!window.firebaseApp.isAutenticado()) {
        console.warn('Usuário não autenticado para edição');
        alert('Você precisa estar logado para editar dados.');
        loginModal.show();
        return;
    }
    
    const row = cell.parentNode;
    const docId = row.getAttribute('data-id');
    const field = cell.getAttribute('data-field');
    const currentValue = parseFloat(cell.getAttribute('data-value'));
    
    console.log(`Editando campo ${field} do documento ${docId} com valor atual ${currentValue}`);
    
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'edit-overlay';
    document.body.appendChild(overlay);
    
    // Criar formulário
    const form = document.createElement('div');
    form.className = 'edit-form';
    
    let formHtml = `
        <h4>Editar ${field === 'empenhado' ? 'Valor Empenhado' : 
                  field === 'liquidado' ? 'Valor Liquidado' : 
                  field === 'objetos' ? 'Objetos Adquiridos' : 'Contas Prestadas'}</h4>
        <div class="mb-3">
    `;
    
    // Adicionar campos específicos com base no campo sendo editado
    if (field === 'objetos') {
        const items = JSON.parse(cell.getAttribute('data-items'));
        
        formHtml += `
            <label for="valor-edit" class="form-label">Quantidade</label>
            <input type="number" class="form-control" id="valor-edit" value="${currentValue}">
            
            <div class="items-editor mt-3">
                <h5>Lista de Objetos</h5>
                <div id="items-container">
        `;
        
        // Adicionar campos para cada item existente
        items.forEach((item, index) => {
            formHtml += `
                <div class="item-input-group">
                    <input type="text" class="form-control item-input" value="${item}">
                    <button type="button" class="btn btn-danger btn-sm remove-item">✕</button>
                </div>
            `;
        });
        
        formHtml += `
                </div>
                <button type="button" class="btn btn-sm btn-success mt-2" id="add-item">Adicionar Item</button>
            </div>
        `;
    } else {
        // Para campos simples (valores numéricos)
        formHtml += `
            <label for="valor-edit" class="form-label">Valor</label>
            <input type="${field === 'empenhado' || field === 'liquidado' ? 'number' : 'number'}" 
                   class="form-control" id="valor-edit" 
                   value="${currentValue}" 
                   step="${field === 'empenhado' || field === 'liquidado' ? '0.01' : '1'}">
        `;
    }
    
    formHtml += `
        </div>
        <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-secondary me-2" id="cancel-edit">Cancelar</button>
            <button type="button" class="btn btn-primary" id="save-edit">Salvar</button>
        </div>
    `;
    
    form.innerHTML = formHtml;
    document.body.appendChild(form);
    
    // Event listeners para botões
    document.getElementById('cancel-edit').addEventListener('click', function() {
        fecharFormularioEdicao(overlay, form);
    });
    
    document.getElementById('save-edit').addEventListener('click', function() {
        salvarEdicao(docId, field, overlay, form);
    });
    
    // Event listener para adicionar novo item (se aplicável)
    const addItemBtn = document.getElementById('add-item');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', function() {
            const container = document.getElementById('items-container');
            const newItemGroup = document.createElement('div');
            newItemGroup.className = 'item-input-group';
            newItemGroup.innerHTML = `
                <input type="text" class="form-control item-input" value="">
                <button type="button" class="btn btn-danger btn-sm remove-item">✕</button>
            `;
            container.appendChild(newItemGroup);
            
            // Adicionar event listener para o botão de remover
            newItemGroup.querySelector('.remove-item').addEventListener('click', function() {
                container.removeChild(newItemGroup);
            });
        });
    }
    
    // Adicionar event listeners para botões de remover item existentes
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemGroup = this.parentNode;
            itemGroup.parentNode.removeChild(itemGroup);
        });
    });
    
    // Fechar formulário ao clicar no overlay
    overlay.addEventListener('click', function() {
        fecharFormularioEdicao(overlay, form);
    });
    
    console.log('Formulário de edição criado com sucesso');
}

// Função para fechar o formulário de edição
function fecharFormularioEdicao(overlay, form) {
    console.log('Fechando formulário de edição');
    document.body.removeChild(overlay);
    document.body.removeChild(form);
}

// Função para salvar as edições no Firebase
async function salvarEdicao(docId, field, overlay, form) {
    console.log(`Salvando edição do campo ${field} do documento ${docId}`);
    try {
        const novoValor = document.getElementById('valor-edit').value;
        
        // Verificar se estamos editando objetos (com lista de itens)
        if (field === 'objetos') {
            // Coletar itens do formulário
            const itemInputs = document.querySelectorAll('.item-input');
            const itens = Array.from(itemInputs).map(input => input.value).filter(val => val.trim() !== '');
            
            console.log(`Atualizando campo ${field} com valor ${novoValor} e ${itens.length} itens`);
            
            // Atualizar documento com novo valor e lista de itens
            const resultado = await window.firebaseApp.atualizarDado(docId, field, novoValor, itens);
            
            if (!resultado.sucesso) {
                console.error('Erro ao atualizar dados:', resultado.mensagem);
                alert(resultado.mensagem);
                return;
            }
        } else {
            console.log(`Atualizando campo ${field} com valor ${novoValor}`);
            
            // Atualizar apenas o campo específico
            const resultado = await window.firebaseApp.atualizarDado(docId, field, novoValor);
            
            if (!resultado.sucesso) {
                console.error('Erro ao atualizar dados:', resultado.mensagem);
                alert(resultado.mensagem);
                return;
            }
        }
        
        // Recarregar dados e atualizar visualização
        await carregarDadosDoFirebase();
        
        // Fechar formulário
        fecharFormularioEdicao(overlay, form);
        
        console.log('Edição salva com sucesso');
    } catch (error) {
        console.error('Erro ao salvar edição:', error);
        alert('Ocorreu um erro ao salvar. Por favor, tente novamente.');
    }
}

// Função para mostrar formulário de novo registro
function mostrarFormularioNovoRegistro() {
    console.log('Mostrando formulário de novo registro');
    
    // Verificar autenticação
    if (!window.firebaseApp.isAutenticado()) {
        console.warn('Usuário não autenticado para criar novo registro');
        alert('Você precisa estar logado para criar novos registros.');
        loginModal.show();
        return;
    }
    
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'edit-overlay';
    document.body.appendChild(overlay);
    
    // Criar formulário
    const form = document.createElement('div');
    form.className = 'edit-form';
    form.style.width = '500px';
    form.style.maxHeight = '80vh';
    form.style.overflow = 'auto';
    
    form.innerHTML = `
        <h4>Novo Registro</h4>
        <div class="mb-3">
            <label for="novo-ano" class="form-label">Ano</label>
            <select id="novo-ano" class="form-select">
                <option value="2019">2019</option>
                <option value="2020">2020</option>
                <option value="2021">2021</option>
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
            </select>
        </div>
        <div class="mb-3">
            <label for="novo-eixo" class="form-label">Eixo Temático</label>
            <select id="novo-eixo" class="form-select">
                <option value="EVM">EVM</option>
                <option value="VPSP-MQVPSP">VPSP-MQVPSP</option>
                <option value="ECV-FISPDS-RMVI">ECV-FISPDS-RMVI</option>
            </select>
        </div>
        <div class="mb-3">
            <label for="novo-natureza" class="form-label">Natureza da Despesa</label>
            <select id="novo-natureza" class="form-select">
                <option value="Custeio">Custeio</option>
                <option value="Investimento">Investimento</option>
            </select>
        </div>
        <div class="mb-3">
            <label for="novo-empenhado" class="form-label">Valor Empenhado</label>
            <input type="number" class="form-control" id="novo-empenhado" value="0" step="0.01">
        </div>
        <div class="mb-3">
            <label for="novo-liquidado" class="form-label">Valor Liquidado</label>
            <input type="number" class="form-control" id="novo-liquidado" value="0" step="0.01">
        </div>
        <div class="mb-3">
            <label for="novo-objetos" class="form-label">Objetos Adquiridos</label>
            <input type="number" class="form-control" id="novo-objetos" value="0">
        </div>
        <div class="mb-3">
            <label for="novo-prestadas" class="form-label">Contas Prestadas</label>
            <input type="number" class="form-control" id="novo-prestadas" value="0">
        </div>
        
        <div class="mb-3">
            <label class="form-label">Lista de Objetos</label>
            <div id="novo-items-container">
                <div class="item-input-group">
                    <input type="text" class="form-control novo-item-input" value="">
                    <button type="button" class="btn btn-danger btn-sm remove-item">✕</button>
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-success mt-2" id="novo-add-item">Adicionar Item</button>
        </div>
        
        <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-secondary me-2" id="novo-cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" id="novo-save">Salvar</button>
        </div>
    `;
    
    document.body.appendChild(form);
    
    // Event listeners para botões
    document.getElementById('novo-cancel').addEventListener('click', function() {
        fecharFormularioEdicao(overlay, form);
    });
    
    document.getElementById('novo-save').addEventListener('click', function() {
        salvarNovoRegistro(overlay, form);
    });
    
    // Event listener para adicionar novo item
    document.getElementById('novo-add-item').addEventListener('click', function() {
        const container = document.getElementById('novo-items-container');
        const newItemGroup = document.createElement('div');
        newItemGroup.className = 'item-input-group';
        newItemGroup.innerHTML = `
            <input type="text" class="form-control novo-item-input" value="">
            <button type="button" class="btn btn-danger btn-sm remove-item">✕</button>
        `;
        container.appendChild(newItemGroup);
        
        // Adicionar event listener para o botão de remover
        newItemGroup.querySelector('.remove-item').addEventListener('click', function() {
            container.removeChild(newItemGroup);
        });
    });
    
    // Adicionar event listeners para botões de remover item existentes
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemGroup = this.parentNode;
            itemGroup.parentNode.removeChild(itemGroup);
        });
    });
    
    // Fechar formulário ao clicar no overlay
    overlay.addEventListener('click', function() {
        fecharFormularioEdicao(overlay, form);
    });
    
    console.log('Formulário de novo registro criado com sucesso');
}

// Função para salvar novo registro no Firebase
async function salvarNovoRegistro(overlay, form) {
    console.log('Salvando novo registro...');
    try {
        // Obter valores do formulário
        const ano = parseInt(document.getElementById('novo-ano').value);
        const eixo = document.getElementById('novo-eixo').value;
        const natureza = document.getElementById('novo-natureza').value;
        const empenhado = parseFloat(document.getElementById('novo-empenhado').value || 0);
        const liquidado = parseFloat(document.getElementById('novo-liquidado').value || 0);
        const objetos = parseInt(document.getElementById('novo-objetos').value || 0);
        const prestadas = parseInt(document.getElementById('novo-prestadas').value || 0);
        
        // Coletar itens do formulário
        const itemInputs = document.querySelectorAll('.novo-item-input');
        const itens = Array.from(itemInputs).map(input => input.value).filter(val => val.trim() !== '');
        
        console.log(`Criando registro: Ano=${ano}, Eixo=${eixo}, Natureza=${natureza}, Empenhado=${empenhado}, Liquidado=${liquidado}, Objetos=${objetos}, Prestadas=${prestadas}, Itens=${itens.length}`);
        
        // Criar novo registro no Firebase
        const resultado = await window.firebaseApp.criarRegistro({
            ano,
            eixo,
            natureza,
            empenhado,
            liquidado,
            objetos,
            prestadas,
            itens
        });
        
        if (!resultado.sucesso) {
            console.error('Erro ao criar registro:', resultado.mensagem);
            alert(resultado.mensagem);
            return;
        }
        
        // Recarregar dados e atualizar visualização
        await carregarDadosDoFirebase();
        
        // Fechar formulário
        fecharFormularioEdicao(overlay, form);
        
        alert('Registro criado com sucesso!');
        console.log('Novo registro salvo com sucesso');
    } catch (error) {
        console.error('Erro ao criar registro:', error);
        alert('Ocorreu um erro ao criar o registro. Por favor, tente novamente.');
    }
}

// Função para excluir registro
async function excluirRegistro(docId) {
    console.log(`Excluindo registro ${docId}...`);
    try {
        const resultado = await window.firebaseApp.excluirRegistro(docId);
        
        if (!resultado.sucesso) {
            console.error('Erro ao excluir registro:', resultado.mensagem);
            alert(resultado.mensagem);
            return;
        }
        
        // Recarregar dados e atualizar visualização
        await carregarDadosDoFirebase();
        
        alert('Registro excluído com sucesso!');
        console.log('Registro excluído com sucesso');
    } catch (error) {
        console.error('Erro ao excluir registro:', error);
        alert('Ocorreu um erro ao excluir o registro. Por favor, tente novamente.');
    }
}

// Função para migrar dados originais para o Firebase
async function migrarDadosOriginais() {
    console.log('Iniciando migração de dados originais...');
    try {
        // Dados originais da aplicação
        const dadosOriginais = [
            // 2019
            {ano: 2019, eixo: "EVM", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2019, eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2019, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 2970380.42, liquidado: 992797.96, objetos: 539, prestadas: 539, itens: ["Exames Laboratoriais", "Equipamentos para Educação Física"]},
            {ano: 2019, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 1883687.83, liquidado: 1883687.83, objetos: 119, prestadas: 119, itens: ["Equipamentos para Treinamento Cardiorrespiratório"]},
            {ano: 2019, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2019, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            
            // 2020
            {ano: 2020, eixo: "EVM", natureza: "Custeio", empenhado: 173300, liquidado: 173300, objetos: 1733, prestadas: 1733, itens: ["Abafador Incêndio Florestal"]},
            {ano: 2020, eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2020, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2020, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 1390572, liquidado: 1384723.8, objetos: 428, prestadas: 428, itens: ["Televisores UHD 65\" LED"]},
            {ano: 2020, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 2049900.85, liquidado: 2046958, objetos: 29, prestadas: 29, itens: ["Curso de Voo por Instrumento", "Curso de Treinamento de Emergência", "Curso de Formação de Pilotos", "Kit de Salvamento em Montanha", "Macacão de Voo"]},
            {ano: 2020, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 8665419.44, liquidado: 8665419.44, objetos: 390, prestadas: 390, itens: ["Desencarceradores", "Motores de Rabeta"]},
            
            // 2021
            {ano: 2021, eixo: "EVM", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2021, eixo: "EVM", natureza: "Investimento", empenhado: 953000, liquidado: 953000, objetos: 4, prestadas: 4, itens: ["Cestos para Lançamento de Água em Helicópteros"]},
            {ano: 2021, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 264475, liquidado: 264475, objetos: 2, prestadas: 2, itens: ["Insumos para Atendimento Pré-Hospitalar Tático"]},
            {ano: 2021, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2021, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 2148378.61, liquidado: 2148378.61, objetos: 4919, prestadas: 4919, itens: ["Mangueiras", "Óculos de Proteção Solar", "EPIs", "Cinto de Posicionamento", "Joelheira Articulada", "Cotoveleira de Salvamento", "Colete Operacional"]},
            {ano: 2021, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 5846915.76, liquidado: 5846915.76, objetos: 55, prestadas: 55, itens: ["Auto Tanque", "Carreta Reboque", "Moto Aquática", "Carreta de Tração Manual"]},
            
            // 2022
            {ano: 2022, eixo: "EVM", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2022, eixo: "EVM", natureza: "Investimento", empenhado: 2240000, liquidado: 2240000, objetos: 2, prestadas: 2, itens: ["Viatura Auto Tanque"]},
            {ano: 2022, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2022, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2022, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 3156124.01, liquidado: 3154021.33, objetos: 5719, prestadas: 5719, itens: ["Mangueiras", "Cotoveleira de Salvamento"]},
            {ano: 2022, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 10163768.19, liquidado: 6382873.42, objetos: 315, prestadas: 79, itens: ["Desencarceradores", "Carretas Reboque", "Jet Ski", "Motosserras", "Afiadores de Corrente", "Sistema de Detecção Acústica"]},
            
            // 2023
            {ano: 2023, eixo: "EVM", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2023, eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2023, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 1224254, liquidado: 387254, objetos: 56, prestadas: 56, itens: ["Participação em Congressos", "Seminários", "Cursos de Capacitação"]},
            {ano: 2023, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2023, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2023, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            
            // 2024
            {ano: 2024, eixo: "EVM", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2024, eixo: "EVM", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2024, eixo: "VPSP-MQVPSP", natureza: "Custeio", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2024, eixo: "VPSP-MQVPSP", natureza: "Investimento", empenhado: 0, liquidado: 0, objetos: 0, prestadas: 0, itens: []},
            {ano: 2024, eixo: "ECV-FISPDS-RMVI", natureza: "Custeio", empenhado: 2689495.2, liquidado: 1344747.6, objetos: 3952, prestadas: 3952, itens: ["Gandola e Calça Laranja CBMERJ"]},
            {ano: 2024, eixo: "ECV-FISPDS-RMVI", natureza: "Investimento", empenhado: 380000, liquidado: 380000, objetos: 2, prestadas: 2, itens: ["Sistema de Detecção Acústica"]}
        ];
        
        console.log(`Migrando ${dadosOriginais.length} registros para o Firebase...`);
        const resultado = await window.firebaseApp.migrarDadosIniciais(dadosOriginais);
        
        if (resultado.sucesso) {
            alert('Dados migrados com sucesso!');
            await carregarDadosDoFirebase();
            console.log('Migração concluída com sucesso');
        } else {
            console.error('Erro na migração de dados:', resultado.mensagem);
            alert(resultado.mensagem);
        }
        
    } catch (error) {
        console.error('Erro ao migrar dados:', error);
        alert('Ocorreu um erro ao migrar os dados. Por favor, tente novamente.');
    }
}

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM carregado, iniciando aplicação...');
    
    try {
        // Verificar se o Firebase foi carregado corretamente
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase não foi carregado. Verifique as referências aos scripts do Firebase.');
        }
        
        // Verificar se Chart.js foi carregado
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js não foi carregado. Os gráficos não serão exibidos.');
        }
        
        // Verificar se Bootstrap foi carregado
        if (typeof bootstrap === 'undefined' || typeof bootstrap.Modal === 'undefined') {
            console.warn('Bootstrap não foi carregado completamente. A interface pode não funcionar corretamente.');
        }
        
        // Inicializar modal de login
        try {
            loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            console.log('Modal de login inicializado');
        } catch (error) {
            console.error('Erro ao inicializar modal de login:', error);
        }
        
        // Verificar autenticação
        console.log('Verificando autenticação...');
        const autenticado = await window.firebaseApp.verificarAutenticacao();
        console.log('Estado de autenticação:', autenticado ? 'Autenticado' : 'Não autenticado');
        
        if (!autenticado) {
            // Mostrar modal de login se não estiver autenticado
            console.log('Usuário não autenticado, exibindo modal de login');
            loginModal.show();
        } else {
            // Carregar dados do Firebase
            console.log('Usuário autenticado, carregando dados...');
            await carregarDadosDoFirebase();
        }
        
        // Event listeners para filtros
        const btnQuantidade = document.getElementById('btnQuantidade');
        const btnObjetos = document.getElementById('btnObjetos');
        
        if (btnQuantidade) {
            btnQuantidade.addEventListener('change', () => {
                visualizacaoAtual = 'quantidade';
                atualizarVisualizacao();
            });
        }
        
        if (btnObjetos) {
            btnObjetos.addEventListener('change', () => {
                visualizacaoAtual = 'objetos';
                atualizarVisualizacao();
            });
        }
        
        // Botão de aplicar filtros
        const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
        if (btnAplicarFiltro) {
            btnAplicarFiltro.addEventListener('click', () => {
                const filtroAno = document.getElementById('filtroAno');
                const filtroEixo = document.getElementById('filtroEixo');
                const filtroNatureza = document.getElementById('filtroNatureza');
                
                filtrosAtuais.ano = filtroAno ? filtroAno.value : 'todos';
                filtrosAtuais.eixo = filtroEixo ? filtroEixo.value : 'todos';
                filtrosAtuais.natureza = filtroNatureza ? filtroNatureza.value : 'todos';
                
                atualizarVisualizacao();
            });
        }
        
        // Botão de novo registro
        const btnNovoRegistro = document.getElementById('btnNovoRegistro');
        if (btnNovoRegistro) {
            btnNovoRegistro.addEventListener('click', () => {
                mostrarFormularioNovoRegistro();
            });
        }
        
        // Botão de migrar dados
        const btnMigrarDados = document.getElementById('btnMigrarDados');
        if (btnMigrarDados) {
            btnMigrarDados.addEventListener('click', () => {
                if (confirm('Esta operação vai migrar os dados originais para o Firebase. Deseja continuar?')) {
                    migrarDadosOriginais();
                }
            });
        }
        
        // Botão de login
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const emailEl = document.getElementById('email');
                const passwordEl = document.getElementById('password');
                const loginErrorEl = document.getElementById('loginError');
                
                if (!emailEl || !passwordEl) {
                    console.error('Elementos de formulário de login não encontrados');
                    return;
                }
                
                const email = emailEl.value;
                const password = passwordEl.value;
                
                console.log(`Tentando login com email: ${email}`);
                const resultado = await window.firebaseApp.fazerLogin(email, password);
                
                if (resultado.sucesso) {
                    console.log('Login realizado com sucesso');
                    loginModal.hide();
                    await carregarDadosDoFirebase();
                } else {
                    console.error('Erro no login:', resultado.mensagem);
                    if (loginErrorEl) {
                        loginErrorEl.textContent = resultado.mensagem;
                    }
                }
            });
        }
        
        // Botão de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                console.log('Realizando logout...');
                await window.firebaseApp.fazerLogout();
                location.reload();
            });
        }
        
        console.log('Inicialização completa');
    } catch (error) {
        console.error('Erro crítico na inicialização da aplicação:', error);
        document.body.innerHTML = `
            <div class="container text-center mt-5">
                <div class="alert alert-danger p-5">
                    <h2>Erro na inicialização</h2>
                    <p>${error.message}</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">Tentar Novamente</button>
                </div>
            </div>
        `;
    }
});