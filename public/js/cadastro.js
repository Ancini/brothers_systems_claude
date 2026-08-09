const supabaseClient = supabase.createClient(
    "https://hnaapsbkrokrkmnzayyr.supabase.co",
    "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u"
);

async function cadastrarUsuario(event) {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const senha = document.getElementById("senha").value;
    const confirmarsenha = document.getElementById("confirmarsenha").value;

    // valida senha
    if (senha !== confirmarsenha) {
        alert("As senhas são diferentes");
        return;
    }

    try {

        // Cria usuário no Auth
        const { data, error } =
            await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: {
                    emailRedirectTo:
                        "https://brotherssystems1-w1o4fqya.b4a.run/redefinir_senha.html"
                }
            });

        if (error) {
            throw error;
        }

        console.log("Retorno signup:", data);

        const authId = data.user?.id;

        console.log("Auth ID:", authId);

        if (!authId) {
            throw new Error(
                "Não foi possível obter o ID do usuário"
            );
        }

        // Verifica se existe sessão/usuário
        const { data: usuarioLogado } =
            await supabaseClient.auth.getUser();

        console.log(
            "Usuário atual:",
            usuarioLogado
        );

        // Salva dados na tabela usuario
        const {
            data: usuarioData,
            error: usuarioError
        } = await supabaseClient
            .from("usuario")
            .insert([
                {
                    nome_usuario: nome,
                    email_usuario: email,
                    telefone_usuario: telefone,
                    auth_id: authId
                }
            ])
            .select();

        if (usuarioError) {
            throw usuarioError;
        }

        console.log(
            "Usuário salvo:",
            usuarioData
        );

        alert(
            "Cadastro realizado com sucesso! Verifique seu e-mail para confirmar sua conta."
        );

    } catch (erro) {

        console.error(
            "Erro geral:",
            erro
        );

        alert(
            erro.message ||
            "Erro ao cadastrar usuário"
        );
    }
}