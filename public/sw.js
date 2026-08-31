// Service worker: só cuida de notificação push. Precisa ficar na raiz de
// public/ (não numa subpasta) pra ter escopo sobre o site inteiro.

self.addEventListener("push", (evento) => {
    let dados = {};
    try {
        dados = evento.data ? evento.data.json() : {};
    } catch (erro) {
        dados = { title: "Brothers Systems", body: evento.data ? evento.data.text() : "" };
    }

    const titulo = dados.title || "Brothers Systems";
    const opcoes = {
        body: dados.body || "",
        icon: "css/imagens/bs_push.png",
        badge: "css/imagens/bs_push.png",
        data: { url: dados.url || "/" }
    };

    evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Clique na notificação: foca uma aba já aberta do app se existir, senão abre uma nova.
self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const url = evento.notification.data?.url || "/";

    evento.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((listaClientes) => {
            for (const cliente of listaClientes) {
                if (cliente.url.includes(url) && "focus" in cliente) return cliente.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});
