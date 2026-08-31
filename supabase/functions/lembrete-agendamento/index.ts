// Edge Function: lembrete-agendamento
// Chamada pelo pg_cron a cada 5 minutos (ver supabase/sql/2026-08-19_lembrete_agendamento.sql).
// Busca agendamentos que começam em ~1h30 e manda um e-mail de lembrete via Resend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Enquanto o domínio de e-mail não estiver verificado no Resend, use o remetente
// de teste deles (onboarding@resend.dev) — só entrega pro seu próprio e-mail cadastrado.
const EMAIL_REMETENTE = Deno.env.get("EMAIL_REMETENTE") ?? "Brothers Systems <onboarding@resend.dev>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function formatarHorario(horario: string | null): string {
  return horario ? horario.slice(0, 5) : "";
}

// Reaproveita a Edge Function enviar-push (mesma usada pelos outros 3 gatilhos
// de notificação) — chamada interna entre functions do mesmo projeto, autenticada
// com a service role key. Nunca lança: push é bônus, não pode derrubar o e-mail.
async function enviarPushLembrete(idUsuario: number, nomeEstabelecimento: string, horario: string | null) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/enviar-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        id_usuario: idUsuario,
        titulo: "Seu horário está chegando! ⏰",
        corpo: `Você tem agendamento na ${nomeEstabelecimento} às ${formatarHorario(horario)}.`,
        url: "meusAgendamentos.html",
      }),
    });
  } catch (erro) {
    console.error(`Erro ao enviar push de lembrete pro usuário ${idUsuario}:`, erro);
  }
}

function montarEmail(nome: string, nomeEstabelecimento: string, horario: string | null) {
  const assunto = "Lembrete de agendamento";
  const texto =
    `Olha ${nome}, tudo bem? Lembre-se que hoje você possui horário marcado na barbearia ${nomeEstabelecimento}, às ${formatarHorario(horario)}.\n\n` +
    `Atenciosamente,\nEquipe Brothers Systems`;
  return { assunto, texto };
}

async function enviarEmail(destinatario: string, assunto: string, texto: string) {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_REMETENTE,
      to: destinatario,
      subject: assunto,
      text: texto,
    }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Resend respondeu ${resposta.status}: ${erro}`);
  }
}

Deno.serve(async () => {
  const { data: agendamentos, error } = await supabase.rpc("agendamentos_para_lembrete");

  if (error) {
    console.error("Erro ao buscar agendamentos para lembrete:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let enviados = 0;
  const falhas: Array<{ id_agendamento: number; erro: string }> = [];

  for (const agendamento of agendamentos ?? []) {
    // Push é tentado sempre, independente de ter e-mail — nunca lança, então
    // não interfere no retry do e-mail abaixo.
    await enviarPushLembrete(
      agendamento.id_usuario,
      agendamento.nome_estabelicimento ?? "a barbearia",
      agendamento.horario_inicio,
    );

    if (!agendamento.email_usuario) {
      console.warn(`Agendamento ${agendamento.id_agendamento} sem e-mail cadastrado, só push.`);
      // Já disparou o push acima; sem isso aqui ficaria tentando de novo a
      // cada rodada do cron dentro da janela dos 85-95min, à toa.
      await supabase
        .from("agendamento")
        .update({ lembrete_enviado: true })
        .eq("id_agendamento", agendamento.id_agendamento);
      enviados++;
      continue;
    }

    try {
      const { assunto, texto } = montarEmail(
        agendamento.nome_usuario ?? "cliente",
        agendamento.nome_estabelicimento ?? "a barbearia",
        agendamento.horario_inicio,
      );

      await enviarEmail(agendamento.email_usuario, assunto, texto);

      const { error: erroUpdate } = await supabase
        .from("agendamento")
        .update({ lembrete_enviado: true })
        .eq("id_agendamento", agendamento.id_agendamento);

      if (erroUpdate) throw erroUpdate;

      enviados++;
    } catch (erro) {
      console.error(`Erro ao enviar lembrete pro agendamento ${agendamento.id_agendamento}:`, erro);
      falhas.push({ id_agendamento: agendamento.id_agendamento, erro: String(erro) });
    }
  }

  return new Response(JSON.stringify({ enviados, falhas }), {
    headers: { "Content-Type": "application/json" },
  });
});
