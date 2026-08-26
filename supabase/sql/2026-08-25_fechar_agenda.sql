-- Fechar Agenda: o barbeiro bloqueia um intervalo de horário em dias específicos
-- da semana atual (ver public/fechar_agenda.html). Só vale pra semana corrente,
-- mesmo padrão de "data concreta" já usado em promocao (public/js/cadastrar_promocao.js).
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

create table if not exists public.bloqueio_agenda (
    id_bloqueio serial primary key,
    id_prestador integer not null,
    data date not null,
    horario_inicio time not null,
    horario_fim time not null,
    check (horario_fim > horario_inicio),
    unique (id_prestador, data)
);

-- Nota: sem FK formal em id_prestador -> prestador.id_prestador de propósito.
-- prestador.id_prestador na verdade é o id_usuario do barbeiro (FK pra usuario),
-- não a PK própria da tabela prestador (que é id_cadastro_prestador) — mesma
-- gambiarra documentada em agendamento.id_prestador, então não é um valor
-- garantidamente único em prestador pra sustentar uma FK de verdade.

alter table public.bloqueio_agenda enable row level security;

-- Leitura liberada geral: o app do cliente precisa disso em selecionar_horario.js
-- pra excluir da lista de horários livres os intervalos que o barbeiro bloqueou,
-- mesmo critério de "informação não sensível" já usado em promocao.
create policy "bloqueio_agenda_select"
on public.bloqueio_agenda
for select
to authenticated, anon
using (true);

-- Escrita só pro próprio barbeiro dono do bloqueio (mesmo padrão de
-- prestador.uuid_vinculo = auth.uid() usado em promocao e no cancelamento
-- de agendamento).
create policy "bloqueio_agenda_barbeiro_escreve"
on public.bloqueio_agenda
for all
to authenticated
using (
    exists (
        select 1 from public.prestador
        where prestador.uuid_vinculo = auth.uid()
        and prestador.id_prestador = bloqueio_agenda.id_prestador
    )
)
with check (
    exists (
        select 1 from public.prestador
        where prestador.uuid_vinculo = auth.uid()
        and prestador.id_prestador = bloqueio_agenda.id_prestador
    )
);

-- Limpeza automática: um bloqueio de data específica não serve mais depois que
-- o dia passa. Mesmo job/critério usado em limpar_promocoes_antigas.
create extension if not exists pg_cron with schema extensions;

create or replace function public.limpar_bloqueios_agenda_antigos()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bloqueio_agenda
  where data < current_date - interval '14 days';
$$;

select cron.schedule(
    'limpar-bloqueios-agenda-antigos',
    '0 3 * * *',
    $$ select public.limpar_bloqueios_agenda_antigos(); $$
);

-- Pra conferir se o job ficou agendado:
-- select * from cron.job where jobname = 'limpar-bloqueios-agenda-antigos';

-- Pra rodar a limpeza manualmente e testar:
-- select public.limpar_bloqueios_agenda_antigos();

-- Pra remover o agendamento, se precisar recriar:
-- select cron.unschedule('limpar-bloqueios-agenda-antigos');
