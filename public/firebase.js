// Configuração do Firebase com suas credenciais reais
const firebaseConfig = {
  apiKey: "AIzaSyBrQdKZVdz-edAqqyC5Ppdu1s5NlbQ9RgI",
  authDomain: "dashboard-orcamentario-suad.firebaseapp.com",
  projectId: "dashboard-orcamentario-suad",
  storageBucket: "dashboard-orcamentario-suad.firebasestorage.app",
  messagingSenderId: "1028558073928",
  appId: "1:1028558073928:web:3dfe00b8b0f00f10a6e87d",
  measurementId: "G-CEGGHM718T"
};

// Verificar se as credenciais foram atualizadas
const credenciaisAtualizadas = 
    firebaseConfig.apiKey !== "SUA_API_KEY" && 
    firebaseConfig.apiKey !== "" &&
    firebaseConfig.appId !== "SEU_APP_ID" && 
    firebaseConfig.appId !== "";

if (!credenciaisAtualizadas) {
    console.error('ERRO: As credenciais do Firebase não foram atualizadas!');
    alert('Erro de configuração: As credenciais do Firebase não foram configuradas corretamente.');
    throw new Error('Credenciais do Firebase não configuradas');
}
  
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Ativar analytics se disponível 
if (firebase.analytics) {
    firebase.analytics();
}
  
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

// Função para verificar conexão com o Firebase
function verificarConexaoFirebase() {
    return new Promise((resolve, reject) => {
        try {
            // Tentar acessar o Firestore para verificar se a conexão está funcionando
            const testRef = db.collection('test').doc('test');
            
            testRef.get()
                .then(() => {
                    console.log('Conexão com o Firebase Firestore estabelecida com sucesso');
                    resolve(true);
                })
                .catch(error => {
                    console.error('Erro ao conectar ao Firebase Firestore:', error);
                    
                    // Verificar tipos específicos de erro
                    if (error.code === 'permission-denied') {
                        reject('Permissão negada. Verifique as regras de segurança do Firestore.');
                    } else if (error.code === 'unavailable') {
                        reject('Serviço do Firebase indisponível. Verifique sua conexão com a internet.');
                    } else {
                        reject(`Erro na conexão: ${error.message}`);
                    }
                });
        } catch (error) {
            console.error('Erro crítico ao inicializar Firebase:', error);
            reject(`Erro crítico: ${error.message}`);
        }
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
  verificarConexaoFirebase,
  isAutenticado: () => usuarioAutenticado
};