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

        // Cria usuário no Auth. Nome/telefone vão nos metadados do auth —
        // uma trigger no banco (on_auth_user_created) lê esses metadados e
        // cria a linha correspondente em "usuario" automaticamente, porque
        // o cliente não tem (e não deve ter) permissão de INSERT direto ali.
        const { data, error } =
            await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: {
                    emailRedirectTo:
                        "https://brothers-systems-claude.vercel.app/index.html",
                    data: {
                        nome,
                        telefone
                    }
                }
            });

        if (error) {
            throw error;
        }

        console.log("Retorno signup:", data);

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