import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyBrQdKZVdz-edAqqyC5Ppdu1s5NlbQ9RgI",
  authDomain: "dashboard-orcamentario-suad.firebaseapp.com",
  projectId: "dashboard-orcamentario-suad",
  storageBucket: "dashboard-orcamentario-suad.firebasestorage.app",
  messagingSenderId: "1028558073928",
  appId: "1:1028558073928:web:3dfe00b8b0f00f10a6e87d",
  measurementId: "G-CEGGHM718T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuarioAutenticado = false;

export { db, auth };

export function verificarAutenticacao() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, function(user) {
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

export async function fazerLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { sucesso: true };
    } catch (error) {
        return { 
            sucesso: false, 
            mensagem: error.message 
        };
    }
}

export async function fazerLogout() {
    await signOut(auth);
}

export async function carregarDados() {
    try {
        const colecao = collection(db, 'despesas');
        const snapshot = await getDocs(colecao);
        const dados = [];
        
        snapshot.forEach(doc => {
            dados.push({ id: doc.id, ...doc.data() });
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

export async function atualizarDado(docId, dadosAtualizacao) {
    try {
        if (!usuarioAutenticado) {
            return { 
                sucesso: false, 
                mensagem: 'Usuário não autenticado.' 
            };
        }
        
        const docRef = doc(db, 'despesas', docId);
        await updateDoc(docRef, dadosAtualizacao);
        
        return { sucesso: true };
    } catch (error) {
        console.error('Erro ao atualizar dado:', error);
        return { 
            sucesso: false, 
            mensagem: 'Erro ao atualizar dado. Tente novamente.' 
        };
    }
}

export async function criarRegistro(dados) {
    try {
        if (!usuarioAutenticado) {
            return { 
                sucesso: false, 
                mensagem: 'Usuário não autenticado.' 
            };
        }
        
        const docId = `${dados.ano}_${dados.eixo.replace(/[^a-zA-Z0-9]/g, '')}_${dados.natureza}_${dados.fundo.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        const docRef = doc(db, 'despesas', docId);
        
        await setDoc(docRef, {
            ano: dados.ano,
            fundo: dados.fundo,
            eixo: dados.eixo,
            natureza: dados.natureza,
            empenhado: dados.empenhado,
            liquidado: dados.liquidado,
            objetos: dados.objetos,
            prestadas: dados.prestadas,
            itens: dados.itens || [],
            ...dados
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

export async function excluirRegistro(docId) {
    try {
        if (!usuarioAutenticado) {
            return { 
                sucesso: false, 
                mensagem: 'Usuário não autenticado.' 
            };
        }
        
        await deleteDoc(doc(db, 'despesas', docId));
        
        return { sucesso: true };
    } catch (error) {
        console.error('Erro ao excluir registro:', error);
        return { 
            sucesso: false, 
            mensagem: 'Erro ao excluir registro. Tente novamente.' 
        };
    }
}

export async function migrarDadosIniciais(dadosResumo) {
    try {
        if (!usuarioAutenticado) {
            return { 
                sucesso: false, 
                mensagem: 'Usuário não autenticado.' 
            };
        }
        
        for (const dado of dadosResumo) {
            if (dado.fundo === 'FUSP') {
                continue;
            }
            
            const eixo = dado.eixo || 'SEM_EIXO';
            const docId = `${dado.ano}_${eixo.replace(/[^a-zA-Z0-9]/g, '')}_${dado.natureza}_${dado.fundo.replace(/[^a-zA-Z0-9]/g, '')}`;
            
            const docRef = doc(db, 'despesas', docId);
            
            const dadosParaSalvar = {
                ano: dado.ano,
                fundo: dado.fundo,
                eixo: eixo,
                natureza: dado.natureza,
                empenhado: dado.empenhado || 0,
                liquidado: dado.liquidado || 0,
                objetos: dado.objetos || 0,
                prestadas: dado.prestadas || 0,
                itens: dado.itens || []
            };
            
            if (dado.numeroEmenda) dadosParaSalvar.numeroEmenda = dado.numeroEmenda;
            if (dado.parlamentar) dadosParaSalvar.parlamentar = dado.parlamentar;
            if (dado.tipo) dadosParaSalvar.tipo = dado.tipo;
            if (dado.autor) dadosParaSalvar.autor = dado.autor;
            if (dado.valor) dadosParaSalvar.valor = dado.valor;
            if (dado.situacao) dadosParaSalvar.situacao = dado.situacao;
            if (dado.valorEmenda) dadosParaSalvar.valorEmenda = dado.valorEmenda;
            if (dado.valorUnitarioEstimado) dadosParaSalvar.valorUnitarioEstimado = dado.valorUnitarioEstimado;
            if (dado.valorUnitarioHomologado) dadosParaSalvar.valorUnitarioHomologado = dado.valorUnitarioHomologado;
            if (dado.ma) dadosParaSalvar.ma = dado.ma;
            if (dado.previsao) dadosParaSalvar.previsao = dado.previsao;
            if (dado.homologado) dadosParaSalvar.homologado = dado.homologado;
            if (dado.saldo) dadosParaSalvar.saldo = dado.saldo;
            if (dado.valorVinculado) dadosParaSalvar.valorVinculado = dado.valorVinculado;
            if (dado.upu) dadosParaSalvar.upu = dado.upu;
            if (dado.uo) dadosParaSalvar.uo = dado.uo;
            if (dado.nomeEmenda) dadosParaSalvar.nomeEmenda = dado.nomeEmenda;
            
            await setDoc(docRef, dadosParaSalvar, { merge: true });
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