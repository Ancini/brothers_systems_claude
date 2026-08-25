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

-- 2.1 Sem uma policy de SELECT, o Postgres nem enxerga a linha pra decidir se o
--     UPDATE acima pode rodar (UPDATE/DELETE também precisam de visibilidade via
--     SELECT/ALL, a policy de UPDATE sozinha não basta). Como a agendamento não tem
--     select liberado de propósito (evita vazar agendamento de outros clientes),
--     essa policy libera só a visão do PRÓPRIO agendamento do barbeiro — mesmo
--     critério de dono usado acima, não expõe nada de outros usuários.
drop policy if exists "barbeiro pode ver seus proprios agendamentos" on public.agendamento;
create policy "barbeiro pode ver seus proprios agendamentos"
on public.agendamento
for select
to authenticated
using (
    id_prestador in (
        select p.id_prestador from public.prestador p where p.uuid_vinculo = auth.uid()
    )
);

-- 2.2 A view usada pelo painel do barbeiro (public/js/controle_barbeiro.js) não
--     trazia a coluna status, então o front não tinha como saber que um agendamento
--     tinha sido cancelado e continuava exibindo ele na lista. Adiciona status no
--     final (seguro pro create or replace view, não muda a ordem das colunas já usadas).
create or replace view public.vw_agenda_do_barbeiro as
select
    a.id_agendamento,
    a.id_prestador,
    a.data_agendamento,
    a.horario_inicio,
    u.nome_usuario as nome_cliente,
    s.nome_servico,
    se.valor_servico,
    a.status
from agendamento a
join usuario u on a.id_usuario = u.id_usuario
join servico_estabelicimento se on a.id_servico_estabelicimento = se.id_servico_estabelicimento
join servico s on se.id_servico = s.id_servico
order by a.data_agendamento, a.horario_inicio;

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
