import { supabase } from "./supabase.js";

// Reaproveita o mesmo client já criado em supabase.js, em vez de criar outro
export const supabaseClient = supabase;

// Salva usuário no navegador
export function salvarSessao(user) {
    localStorage.setItem("usuarioLogado", JSON.stringify(user));
}

// Pega usuário logado
export function pegarSessao() {
    return JSON.parse(localStorage.getItem("usuarioLogado"));
}

// Remove sessão (logout)
export function logout() {
    localStorage.removeItem("usuarioLogado");
    console.log("Usuário deslogado, sessão removida");
}

export async function efetuarLogin(email, senha) {
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (authError) throw authError;

        const { data: dadosUsuario, error: dbError } = await supabaseClient
            .from('usuario')
            .select('id_usuario, barbeiro, administrador')
            .eq('auth_id', authData.user.id)
            .single();

        if (dbError) {
            console.warn("Aviso: Não foi possível buscar o perfil na tabela usuario:", dbError.message);
        }

        const usuarioCompleto = {
            ...authData.user,
            id_usuario: dadosUsuario ? dadosUsuario.id_usuario : null,
            barbeiro: dadosUsuario ? dadosUsuario.barbeiro : false,
            administrador: dadosUsuario ? dadosUsuario.administrador : false
        };

        salvarSessao(usuarioCompleto);

        return { sucesso: true, usuario: usuarioCompleto };

    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

export function verificarFluxoUsuario() {
  const usuario = pegarSessao();
  
  if (!usuario) {
      console.log("Nenhum usuário logado.");
      return "login.html"; 
  }

  if (usuario.administrador === true || usuario.administrador === "true") {
      console.log(`O usuário é administrador.`);
      return {
          eAdministrador: true,
          telaInicial: "menu_administrador.html",
          exibirBotaoPainel: true
      };
  }

  if (usuario.barbeiro === true || usuario.barbeiro === "true" || usuario.barbeiro === "s") {
      console.log(`O usuário é um barbeiro ativo.`);
      return {
          eBarbeiro: true,
          telaInicial: "home_cliente.html",
          exibirBotaoPainel: true
      };
  }

  return {
      eBarbeiro: false,
      telaInicial: "home_cliente.html",
      exibirBotaoPainel: false
  };
}