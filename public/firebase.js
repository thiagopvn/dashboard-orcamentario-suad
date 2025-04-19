// Configuração do Firebase - SUBSTITUA COM SUAS CREDENCIAIS WEB
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "dashboard-orcamentario-suad.firebaseapp.com",
    projectId: "dashboard-orcamentario-suad",
    storageBucket: "dashboard-orcamentario-suad.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
  };
  
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Referências globais
  const db = firebase.firestore();
  const auth = firebase.auth();
  
  // Controle de autenticação
  let usuarioAutenticado = false;
  
  // Função para verificar autenticação
  function verificarAutenticacao() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(function(user) {
        if (user) {
          usuarioAutenticado = true;
          document.querySelectorAll('.btn-edit-control').forEach(btn => {
            btn.style.display = 'block';
          });
          resolve(true);
        } else {
          usuarioAutenticado = false;
          document.querySelectorAll('.btn-edit-control').forEach(btn => {
            btn.style.display = 'none';
          });
          resolve(false);
        }
      });
    });
  }
  
  // Função para fazer login
  async function fazerLogin(email, password) {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      return { sucesso: true };
    } catch (error) {
      return { 
        sucesso: false, 
        mensagem: error.message 
      };
    }
  }
  
  // Função para fazer logout
  async function fazerLogout() {
    await auth.signOut();
  }
  
  // Função para carregar dados
  async function carregarDados() {
    try {
      const snapshot = await db.collection('dadosOrcamentarios').get();
      const dados = [];
      
      snapshot.forEach(doc => {
        dados.push(doc.data());
      });
      
      return { sucesso: true, dados };
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      return { 
        sucesso: false, 
        mensagem: 'Erro ao carregar dados. Tente novamente.' 
      };
    }
  }
  
  // Função para atualizar um dado
  async function atualizarDado(docId, campo, valor, itens = null) {
    try {
      if (!usuarioAutenticado) {
        return { 
          sucesso: false, 
          mensagem: 'Usuário não autenticado.' 
        };
      }
      
      const docRef = db.collection('dadosOrcamentarios').doc(docId);
      
      let dadosAtualizacao = {
        [campo]: campo === 'empenhado' || campo === 'liquidado' ? 
                 parseFloat(valor) : 
                 parseInt(valor)
      };
      
      // Se estamos atualizando objetos e temos uma lista de itens
      if (campo === 'objetos' && itens !== null) {
        dadosAtualizacao['itens'] = itens;
      }
      
      await docRef.update(dadosAtualizacao);
      
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao atualizar dado:', error);
      return { 
        sucesso: false, 
        mensagem: 'Erro ao atualizar dado. Tente novamente.' 
      };
    }
  }
  
  // Função para criar novo registro
  async function criarRegistro(dados) {
    try {
      if (!usuarioAutenticado) {
        return { 
          sucesso: false, 
          mensagem: 'Usuário não autenticado.' 
        };
      }
      
      // Criar ID único para o documento
      const docId = `${dados.ano}_${dados.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${dados.natureza}`;
      
      // Verificar se já existe um registro com esse ID
      const docRef = db.collection('dadosOrcamentarios').doc(docId);
      const doc = await docRef.get();
      
      if (doc.exists) {
        return { 
          sucesso: false, 
          mensagem: 'Já existe um registro para esta combinação de Ano, Eixo e Natureza.' 
        };
      }
      
      // Criar novo documento no Firestore
      await docRef.set({
        ano: dados.ano,
        eixo: dados.eixo,
        natureza: dados.natureza,
        empenhado: dados.empenhado,
        liquidado: dados.liquidado,
        objetos: dados.objetos,
        prestadas: dados.prestadas,
        itens: dados.itens || []
      });
      
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao criar registro:', error);
      return { 
        sucesso: false, 
        mensagem: 'Erro ao criar registro. Tente novamente.' 
      };
    }
  }
  
  // Função para excluir um registro
  async function excluirRegistro(docId) {
    try {
      if (!usuarioAutenticado) {
        return { 
          sucesso: false, 
          mensagem: 'Usuário não autenticado.' 
        };
      }
      
      await db.collection('dadosOrcamentarios').doc(docId).delete();
      
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      return { 
        sucesso: false, 
        mensagem: 'Erro ao excluir registro. Tente novamente.' 
      };
    }
  }
  
  // Função para migrar dados iniciais para o Firebase
  async function migrarDadosIniciais(dadosResumo) {
    try {
      if (!usuarioAutenticado) {
        return { 
          sucesso: false, 
          mensagem: 'Usuário não autenticado.' 
        };
      }
      
      // Para cada item do array dadosResumo
      for (const dado of dadosResumo) {
        // Criar um ID único baseado nas propriedades
        const docId = `${dado.ano}_${dado.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${dado.natureza}`;
        
        // Verificar se o documento já existe
        const docRef = db.collection('dadosOrcamentarios').doc(docId);
        const doc = await docRef.get();
        
        // Se o documento não existir, crie-o
        if (!doc.exists) {
          await docRef.set({
            ano: dado.ano,
            eixo: dado.eixo,
            natureza: dado.natureza,
            empenhado: dado.empenhado,
            liquidado: dado.liquidado,
            objetos: dado.objetos,
            prestadas: dado.prestadas,
            itens: dado.itens || []
          });
        }
      }
      
      return { sucesso: true };
    } catch (error) {
      console.error('Erro na migração:', error);
      return { 
        sucesso: false, 
        mensagem: 'Erro na migração de dados. Tente novamente.' 
      };
    }
  }
  
  // Exportar funções para uso externo
  window.firebaseApp = {
    verificarAutenticacao,
    fazerLogin,
    fazerLogout,
    carregarDados,
    atualizarDado,
    criarRegistro,
    excluirRegistro,
    migrarDadosIniciais,
    isAutenticado: () => usuarioAutenticado
  };