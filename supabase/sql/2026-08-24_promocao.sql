-- Promoções por data específica cadastradas pelo próprio barbeiro
-- (ver public/cadastrar_promocao.html). Rode este arquivo inteiro no
-- Supabase -> SQL Editor.

create table if not exists public.promocao (
    id_promocao serial primary key,
    id_estabelicimento integer not null references public.estabelicimento(id_estabelicimento) on delete cascade,
    data_promocao date not null,
    percentual_desconto smallint not null check (percentual_desconto between 1 and 100),
    unique (id_estabelicimento, data_promocao)
);

alter table public.promocao enable row level security;

-- Leitura liberada pra authenticated e anon: o app precisa disso pra saber,
-- na listagem de barbearias (menu_cliente.js), se alguma tem promoção hoje.
create policy "promocao_select"
on public.promocao
for select
to authenticated, anon
using (true);

-- Escrita só pro barbeiro vinculado àquele estabelecimento (via prestador.uuid_vinculo,
-- mesmo padrão usado em public/js/controle_barbeiro.js) — não é por administrador
-- como em horario_funcionamento, porque essa tela vive no painel do barbeiro.
create policy "promocao_barbeiro_escreve"
on public.promocao
for all
to authenticated
using (
    exists (
        select 1 from public.prestador
        where prestador.uuid_vinculo = auth.uid()
        and prestador.id_estabelicimento = promocao.id_estabelicimento
    )
)
with check (
    exists (
        select 1 from public.prestador
        where prestador.uuid_vinculo = auth.uid()
        and prestador.id_estabelicimento = promocao.id_estabelicimento
    )
);

-- Limpeza automática: uma promoção de data específica não serve mais depois
-- que o dia passa, então não faz sentido guardar isso pra sempre. Em vez de um
-- TRIGGER (que só dispara em resposta a um INSERT/UPDATE/DELETE, não a "o tempo passou"),
-- o jeito certo pra "apagar depois de um tempo" é um JOB AGENDADO (pg_cron),
-- rodando todo dia e apagando o que já venceu há mais de 2 semanas.
create extension if not exists pg_cron with schema extensions;

create or replace function public.limpar_promocoes_antigas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.promocao
  where data_promocao < current_date - interval '14 days';
$$;

-- Roda todo dia às 3h da manhã (fuso do servidor do Postgres, geralmente UTC).
select cron.schedule(
    'limpar-promocoes-antigas',
    '0 3 * * *',
    $$ select public.limpar_promocoes_antigas(); $$
);

-- Pra conferir se o job ficou agendado:
-- select * from cron.job where jobname = 'limpar-promocoes-antigas';

-- Pra rodar a limpeza manualmente e testar:
-- select public.limpar_promocoes_antigas();

-- Pra remover o agendamento, se precisar recriar:
-- select cron.unschedule('limpar-promocoes-antigas');
