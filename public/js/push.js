import { supabase } from "./supabase.js";
import { pegarSessao } from "./session.js";

// Chave pública VAPID — segura pra expor no cliente (a privada fica só como
// secret da Edge Function enviar-push, nunca aqui).
const VAPID_PUBLIC_KEY = "BLHEjgFlBAv_19KqPLAGhXZKXuiXzSOpfuxVbfzXRp91UOnVAXKEWcO6xotG3ou2A8NZxgiDEqMMo29qiZk2CLw";

function urlBase64ParaUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function suportaPush() {
    return "serviceWorker" in navigator && "PushManager" in window;
}

// "ativo" | "inativo" | "negado" | "indisponivel"
export async function statusInscricaoPush() {
    if (!suportaPush()) return "indisponivel";
    if (Notification.permission === "denied") return "negado";

    const registro = await navigator.serviceWorker.getRegistration();
    const inscricao = registro ? await registro.pushManager.getSubscription() : null;
    return inscricao ? "ativo" : "inativo";
}

export async function ativarNotificacoes() {
    if (!suportaPush()) {
        alert("Esse navegador não suporta notificações push. No iPhone, adicione o app à Tela de Início primeiro (compartilhar → Adicionar à Tela de Início) e abra por ali.");
        return false;
    }

    const usuario = pegarSessao();
    if (!usuario?.id_usuario) {
        alert("Você precisa estar logado.");
        return false;
    }

    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
        alert("Notificações não foram permitidas.");
        return false;
    }

    try {
        const registro = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        let inscricao = await registro.pushManager.getSubscription();
        if (!inscricao) {
            inscricao = await registro.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ParaUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        const dados = inscricao.toJSON();
        const { error } = await supabase.from("push_subscription").upsert({
            id_usuario: usuario.id_usuario,
            endpoint: dados.endpoint,
            p256dh: dados.keys.p256dh,
            auth: dados.keys.auth
        }, { onConflict: "endpoint" });

        if (error) throw error;

        return true;
    } catch (erro) {
        console.error("Erro ao ativar notificações:", erro);
        alert("Não foi possível ativar as notificações. Tente de novo.");
        return false;
    }
}

// Se já existe um service worker registrado (de uma ativação anterior nesse
// aparelho), força uma checagem por versão nova toda vez que a página carrega
// — sem isso, o navegador só rechecha sozinho de tempos em tempos (pode levar
// até um dia), e o usuário fica preso numa versão antiga do sw.js até lá.
async function verificarAtualizacaoServiceWorker() {
    if (!suportaPush()) return;
    try {
        const registro = await navigator.serviceWorker.getRegistration();
        if (registro) await registro.update();
    } catch (erro) {
        console.error("Erro ao checar atualização do service worker:", erro);
    }
}

// Liga um botão existente na página ao fluxo de ativação, já refletindo o
// status atual (some se o navegador não suporta, trava se já está ativo).
// Não usa a propriedade .disabled porque o botão às vezes é uma <div class="card">
// (padrão usado em menu_inicial_barbeiro.html), que não tem esse comportamento
// nativo — o "trava" é feito na mão com uma flag, funciona pra qualquer elemento.
export function configurarBotaoNotificacoes(idBotao) {
    verificarAtualizacaoServiceWorker();

    const botao = document.getElementById(idBotao);
    if (!botao) return;

    const textoOriginal = botao.textContent;
    let jaAtivo = false;

    function marcarAtivo() {
        jaAtivo = true;
        botao.textContent = "🔔 Notificações ativadas";
        botao.style.opacity = "0.7";
        botao.style.cursor = "default";
    }

    statusInscricaoPush().then((status) => {
        if (status === "ativo") {
            marcarAtivo();
        } else if (status === "indisponivel") {
            botao.style.display = "none";
        }
    });

    botao.addEventListener("click", async () => {
        if (jaAtivo) return;

        botao.textContent = "Ativando...";
        const sucesso = await ativarNotificacoes();

        if (sucesso) {
            marcarAtivo();
        } else {
            botao.textContent = textoOriginal;
        }
    });
}

// Dispara uma notificação via Edge Function — usado nos 4 gatilhos (confirmação
// de agendamento, novo agendamento pro barbeiro, lembrete, promoção cadastrada).
// Nunca lança erro pra quem chamou: notificação é um "bônus", uma falha aqui
// não pode quebrar o fluxo principal (agendar, cadastrar promoção etc).
export async function enviarPush(payload) {
    try {
        const { error } = await supabase.functions.invoke("enviar-push", { body: payload });
        if (error) console.error("Erro ao enviar notificação push:", error);
    } catch (erro) {
        console.error("Erro ao enviar notificação push:", erro);
    }
}
