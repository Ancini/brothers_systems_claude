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

-- Pra conferir depois de rodar:
-- select * from public.horario_funcionamento order by id_estabelicimento, dia_semana;
