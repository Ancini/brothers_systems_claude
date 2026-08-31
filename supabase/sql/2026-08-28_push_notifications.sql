-- Push notifications (Web Push): tabela de inscrições + funções de apoio.
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

-- 1. Tabela de inscrições push — uma linha por dispositivo/navegador que o
--    usuário ativou notificações. "endpoint" é único por dispositivo (o
--    upsert no cliente usa isso pra não duplicar se ativar de novo).
create table if not exists public.push_subscription (
  id serial primary key,
  id_usuario integer not null references public.usuario(id_usuario) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

alter table public.push_subscription enable row level security;

-- Cada usuário só enxerga/gerencia as próprias inscrições. A Edge Function
-- (service_role) ignora RLS e enxerga tudo, então não precisa de policy extra pra ela.
drop policy if exists "usuario ve suas proprias inscricoes push" on public.push_subscription;
create policy "usuario ve suas proprias inscricoes push"
on public.push_subscription for select
to authenticated
using (id_usuario in (select id_usuario from public.usuario where auth_id = auth.uid()));

drop policy if exists "usuario cria suas proprias inscricoes push" on public.push_subscription;
create policy "usuario cria suas proprias inscricoes push"
on public.push_subscription for insert
to authenticated
with check (id_usuario in (select id_usuario from public.usuario where auth_id = auth.uid()));

drop policy if exists "usuario atualiza suas proprias inscricoes push" on public.push_subscription;
create policy "usuario atualiza suas proprias inscricoes push"
on public.push_subscription for update
to authenticated
using (id_usuario in (select id_usuario from public.usuario where auth_id = auth.uid()))
with check (id_usuario in (select id_usuario from public.usuario where auth_id = auth.uid()));

drop policy if exists "usuario remove suas proprias inscricoes push" on public.push_subscription;
create policy "usuario remove suas proprias inscricoes push"
on public.push_subscription for delete
to authenticated
using (id_usuario in (select id_usuario from public.usuario where auth_id = auth.uid()));

-- 2. agendamentos_para_lembrete ganha id_usuario (além do que já tinha) —
--    a Edge Function de lembrete usa isso pra também mandar push, não só e-mail.
--    Postgres não deixa "CREATE OR REPLACE" mudar as colunas de retorno de uma
--    função que já existe (erro 42P13) — precisa dropar antes de recriar.
drop function if exists public.agendamentos_para_lembrete();

create or replace function public.agendamentos_para_lembrete()
returns table (
  id_agendamento integer,
  id_usuario integer,
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
    a.id_usuario,
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

revoke all on function public.agendamentos_para_lembrete() from public, anon, authenticated;
grant execute on function public.agendamentos_para_lembrete() to service_role;

-- 3. Resolve os clientes de uma barbearia específica (pra notificação de
--    promoção cadastrada) — só quem já agendou ali, não a base toda de usuários.
--    security definer: só a Edge Function (service_role) deveria chamar isso,
--    já que devolve uma lista de ids de cliente.
create or replace function public.clientes_do_estabelecimento(estab_id integer)
returns table (id_usuario integer)
language sql
security definer
set search_path = public
as $$
  select distinct a.id_usuario
  from public.agendamento a
  where a.id_estabelicimento = estab_id;
$$;

revoke all on function public.clientes_do_estabelecimento(integer) from public, anon, authenticated;
grant execute on function public.clientes_do_estabelecimento(integer) to service_role;
