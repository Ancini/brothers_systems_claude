-- Lembrete de agendamento por e-mail, disparado 1h30 antes do horário marcado.
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

-- 1. Coluna de controle: evita mandar o mesmo lembrete duas vezes.
alter table public.agendamento
add column if not exists lembrete_enviado boolean not null default false;

-- 2. Função que devolve os agendamentos cujo horário cai entre 85 e 95 minutos
--    a partir de agora, e que ainda não tiveram lembrete enviado.
--    (janela de 10min pra casar com o cron rodando a cada 5-10min sem furar nem duplicar)
--    security definer: roda com privilégio elevado, então funciona mesmo com RLS
--    restrito em usuario/estabelicimento.
create or replace function public.agendamentos_para_lembrete()
returns table (
  id_agendamento integer,
  email_usuario varchar,
  nome_usuario text,
  nome_estabelicimento text,
  horario_inicio time
)
language sql
security definer
set search_path = public
as $$
  select
    a.id_agendamento,
    u.email_usuario,
    u.nome_usuario,
    e.nome_estabelicimento,
    a.horario_inicio
  from public.agendamento a
  join public.usuario u on u.id_usuario = a.id_usuario
  join public.estabelicimento e on e.id_estabelicimento = a.id_estabelicimento
  where a.lembrete_enviado = false
    and (a.data_agendamento + a.horario_inicio) at time zone 'America/Sao_Paulo'
        between now() + interval '85 minutes' and now() + interval '95 minutes';
$$;

-- Só a service role (usada pela Edge Function) pode chamar essa função —
-- ela expõe e-mail/nome de cliente, não deve ficar aberta pro app do navegador.
revoke all on function public.agendamentos_para_lembrete() from public, anon, authenticated;
grant execute on function public.agendamentos_para_lembrete() to service_role;

-- 3. Extensões necessárias pro agendador rodar dentro do próprio Postgres.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 4. Agendamento: chama a Edge Function a cada 5 minutos.
--    IMPORTANTE: troque <PROJECT_REF> pela referência do seu projeto (aparece na URL
--    do Supabase, ex: hnaapsbkrokrkmnzayyr) e <SERVICE_ROLE_KEY> pela Service Role Key
--    (Project Settings -> API -> service_role, NÃO a anon/publishable).
select cron.schedule(
  'lembrete-agendamento-1h30',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/lembrete-agendamento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra conferir se o cron está agendado:
-- select * from cron.job;

-- Pra remover, se precisar recriar:
-- select cron.unschedule('lembrete-agendamento-1h30');
