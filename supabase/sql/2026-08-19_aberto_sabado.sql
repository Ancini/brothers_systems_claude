-- Permite que uma barbearia feche o agendamento online aos sábados
-- (atendimento por ordem de chegada nesse dia).
-- Rode este arquivo inteiro no Supabase -> SQL Editor.

alter table public.estabelicimento
add column if not exists aberto_sabado boolean not null default true;

-- Pra desligar o agendamento de sábado numa barbearia específica:
-- update public.estabelicimento set aberto_sabado = false where id_estabelicimento = <ID>;
