-- Dias/horários de funcionamento por barbearia, um por dia da semana.
-- Substitui, no futuro, o "aberto_sabado" (2026-08-19), que era só um paliativo.
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

create table if not exists public.horario_funcionamento (
    id_horario_funcionamento serial primary key,
    id_estabelicimento integer not null references public.estabelicimento(id_estabelicimento) on delete cascade,
    dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo ... 6 = sábado (igual ao Date.getDay() do JS)
    aberto boolean not null default true,
    horario_abertura time,
    horario_fechamento time,
    unique (id_estabelicimento, dia_semana)
);

-- RLS: mesma lógica das outras tabelas do app — leitura liberada pra
-- authenticated e anon (o app lê isso pra montar a agenda de qualquer cliente,
-- logado ou não), escrita só deveria valer pra administrador (ajuste a policy
-- de insert/update conforme a policy de administrador que você já usa nas
-- outras tabelas de cadastro, tipo "estabelicimento" e "servico_estabelicimento").
alter table public.horario_funcionamento enable row level security;

create policy "horario_funcionamento_select"
on public.horario_funcionamento
for select
to authenticated, anon
using (true);

-- Escrita (insert/update/delete) só pra quem é administrador — mesma checagem
-- (usuario.auth_id = auth.uid() e usuario.administrador = true) que dá pra
-- reaproveitar nas outras tabelas de cadastro (estabelicimento, servico_estabelicimento
-- etc.) se elas ainda não tiverem essa policy.
create policy "horario_funcionamento_admin_escreve"
on public.horario_funcionamento
for all
to authenticated
using (
    exists (
        select 1 from public.usuario
        where usuario.auth_id = auth.uid()
        and usuario.administrador = true
    )
)
with check (
    exists (
        select 1 from public.usuario
        where usuario.auth_id = auth.uid()
        and usuario.administrador = true
    )
);

-- Pra conferir depois de rodar:
-- select * from public.horario_funcionamento order by id_estabelicimento, dia_semana;
