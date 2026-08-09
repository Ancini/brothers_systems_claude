const supabaseClient = supabase.createClient(
    "https://hnaapsbkrokrkmnzayyr.supabase.co",
    "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u"
);

async function recuperarSenha(event) {
    event.preventDefault();

    const email =
        document.getElementById("email").value;

    const { error } =
        await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
                redirectTo:
                "https://brothers-systems-web.vercel.app/redefinir_senha.html"
            }
        );

    if (error) {
        console.log(error);
        alert(error.message);
        return;
    }

    alert("Email de recuperação enviado!");
}