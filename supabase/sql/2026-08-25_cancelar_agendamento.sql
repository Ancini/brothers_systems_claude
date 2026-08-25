-- Permite o barbeiro cancelar (status = 'cancelado') um agendamento da própria agenda,
-- puxado pelo swipe no card de "Meus Agendamentos" (public/js/controle_barbeiro.js).
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

-- 1. Garante RLS ativo na tabela (idempotente se já estiver).
alter table public.agendamento enable row level security;

-- 2. Policy: o barbeiro só pode dar update num agendamento cujo id_prestador
--    seja o dele mesmo (vínculo via prestador.uuid_vinculo = auth.uid()).
--    with check repete a mesma condição pra impedir o update de "mudar de dono"
--    o agendamento pra um id_prestador que não é o do barbeiro logado.
drop policy if exists "barbeiro pode cancelar seus proprios agendamentos" on public.agendamento;
create policy "barbeiro pode cancelar seus proprios agendamentos"
on public.agendamento
for update
to authenticated
using (
    id_prestador in (
        select p.id_prestador from public.prestador p where p.uuid_vinculo = auth.uid()
    )
)
with check (
    id_prestador in (
        select p.id_prestador from public.prestador p where p.uuid_vinculo = auth.uid()
    )
);

-- 3. Evita mandar lembrete de um agendamento que já foi cancelado
--    (a função já existe, criada em 2026-08-19_lembrete_agendamento.sql — isso só
--    troca o "where" dela pra incluir o filtro de status).
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
    and a.status is distinct from 'cancelado'
    and (a.data_agendamento + a.horario_inicio) at time zone 'America/Sao_Paulo'
        between now() + interval '85 minutes' and now() + interval '95 minutes';
$$;
