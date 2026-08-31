// Edge Function: enviar-push
// Ponto único de envio de notificação push, usado pelos 4 gatilhos do app:
// confirmação de agendamento, novo agendamento (barbeiro), lembrete (chamada
// por lembrete-agendamento) e promoção cadastrada.
//
// Corpo aceito (um dos dois formatos de destinatário, mais titulo/corpo):
//   { id_usuario: number | number[], titulo, corpo, url? }
//   { id_estabelicimento: number, titulo, corpo, url? }  -> manda pra todo
//     cliente que já tem agendamento naquela loja (ver clientes_do_estabelecimento).
//
// Chamada publicamente por qualquer usuário autenticado (o app chama direto
// do navegador do cliente/barbeiro) — não valida se quem chama "tem o direito"
// de notificar aquele id_usuario. Suficiente pro estágio atual do projeto, mas
// é um vetor de abuso (spam de notificação) se algum dia isso importar mais;
// nesse caso, adicionar checagem de papel (dono/admin) antes de resolver
// destinatários por id_estabelicimento.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@brothersystems.com.br";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface CorpoRequisicao {
  id_usuario?: number | number[];
  id_estabelicimento?: number;
  titulo: string;
  corpo: string;
  url?: string;
}

async function resolverDestinatarios(payload: CorpoRequisicao): Promise<number[]> {
  if (payload.id_estabelicimento) {
    const { data, error } = await supabase.rpc("clientes_do_estabelecimento", {
      estab_id: payload.id_estabelicimento,
    });
    if (error) throw error;
    return (data ?? []).map((linha: { id_usuario: number }) => linha.id_usuario);
  }

  if (Array.isArray(payload.id_usuario)) return payload.id_usuario;
  if (typeof payload.id_usuario === "number") return [payload.id_usuario];
  return [];
}

Deno.serve(async (req) => {
  let payload: CorpoRequisicao;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload.titulo || !payload.corpo) {
    return new Response(JSON.stringify({ error: "titulo e corpo são obrigatórios" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let destinatarios: number[];
  try {
    destinatarios = await resolverDestinatarios(payload);
  } catch (erro) {
    console.error("Erro ao resolver destinatários:", erro);
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (destinatarios.length === 0) {
    return new Response(JSON.stringify({ enviados: 0, falhas: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: inscricoes, error: erroInscricoes } = await supabase
    .from("push_subscription")
    .select("id, id_usuario, endpoint, p256dh, auth")
    .in("id_usuario", destinatarios);

  if (erroInscricoes) {
    console.error("Erro ao buscar inscrições push:", erroInscricoes);
    return new Response(JSON.stringify({ error: erroInscricoes.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let enviados = 0;
  const falhas: Array<{ id: number; erro: string }> = [];

  for (const inscricao of inscricoes ?? []) {
    const assinatura = {
      endpoint: inscricao.endpoint,
      keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
    };

    try {
      await webpush.sendNotification(
        assinatura,
        JSON.stringify({ title: payload.titulo, body: payload.corpo, url: payload.url ?? "/" }),
      );
      enviados++;
    } catch (erro) {
      // 404/410 = inscrição expirada/revogada (usuário desinstalou, trocou de
      // navegador etc.) — não tem como reenviar, então já limpa do banco.
      const status = (erro as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscription").delete().eq("id", inscricao.id);
      }
      console.error(`Erro ao enviar push pra inscrição ${inscricao.id}:`, erro);
      falhas.push({ id: inscricao.id, erro: String(erro) });
    }
  }

  return new Response(JSON.stringify({ enviados, falhas }), {
    headers: { "Content-Type": "application/json" },
  });
});
