-- =============================================================================
-- Alteração à base de dados — ranking dos restaurantes entre os estudantes (25 nov 2026)
-- Estado: APLICADA a 25 nov 2026 (migração "ranking_dos_estudantes"), depois do OK do Rodrigo
-- (ideia do professor: um ranking dos restaurantes com mais sucesso entre os estudantes).
-- =============================================================================
--
-- O que muda:
--   1. Tabela idas: "Vou almoçar aqui". Cada cliente marca no máximo um restaurante por dia (pode mudar
--      de ideias ou desmarcar). Só se marca o dia de hoje e só contas de cliente marcam.
--   2. popularidade_dos_restaurantes(ids): quantos estudantes vão hoje e quantos foram nos últimos 7 dias
--      a cada restaurante. Devolve SÓ contagens, nunca quem foi (RGPD).
--   3. marcar_ida(restaurante) e desmarcar_ida(): a app marca e desmarca a ida de hoje.
--   4. idas_de_demonstracao + simular_idas_de_demonstracao(): visitas SIMULADAS só para os restaurantes de
--      demonstração (contas demo-…@emmmenta-demo.pt), para o ranking não começar vazio na demonstração.
--      São números inventados, guardados à parte (nunca misturados com idas verdadeiras), e devem ser
--      apresentados como dados de demonstração.
--   5. Limpeza: as idas com mais de 30 dias apagam-se sozinhas (tarefa pg_cron "limpar-idas", todos os dias).
--
-- Regras de segurança (RLS):
--   - idas: cada cliente só vê, marca, muda e apaga as suas; ninguém vê as idas dos outros.
--   - idas_de_demonstracao: RLS ligada e sem políticas — só as funções da base de dados lhe mexem.
--   - As tabelas que já existiam ficam iguais.
--   - As funções security definer (que contam ou simulam) só devolvem contagens ou não podem ser
--     chamadas pela app (anon e authenticated sem permissão, exceto popularidade_dos_restaurantes).
--
-- Como desfazer:
--   select cron.unschedule('idas-de-demonstracao');
--   select cron.unschedule('limpar-idas');
--   drop function public.popularidade_dos_restaurantes(uuid[]);
--   drop function public.marcar_ida(uuid);
--   drop function public.desmarcar_ida();
--   drop function public.simular_idas_de_demonstracao();
--   drop function public.limpar_idas_antigas();
--   drop table public.idas;
--   drop table public.idas_de_demonstracao;
-- =============================================================================

-- 1. As idas ("Vou almoçar aqui")
create table public.idas (
  cliente_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  dia date not null default ((now() at time zone 'Europe/Lisbon')::date),
  criado_em timestamptz not null default now(),
  primary key (cliente_id, dia) -- um restaurante por cliente e por dia
);
create index idas_por_restaurante on public.idas (restaurante_id, dia);

alter table public.idas enable row level security;

create policy "idas: ver as próprias" on public.idas
  for select to authenticated
  using ((select auth.uid()) = cliente_id);

create policy "idas: cliente marca a de hoje" on public.idas
  for insert to authenticated
  with check (
    (select auth.uid()) = cliente_id
    and dia = (now() at time zone 'Europe/Lisbon')::date
    and exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.tipo = 'cliente')
  );

create policy "idas: muda a de hoje" on public.idas
  for update to authenticated
  using ((select auth.uid()) = cliente_id and dia = (now() at time zone 'Europe/Lisbon')::date)
  with check ((select auth.uid()) = cliente_id and dia = (now() at time zone 'Europe/Lisbon')::date);

create policy "idas: apaga as próprias" on public.idas
  for delete to authenticated
  using ((select auth.uid()) = cliente_id);

-- 2. Visitas simuladas dos restaurantes de demonstração (à parte das verdadeiras)
create table public.idas_de_demonstracao (
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  dia date not null,
  quantas integer not null check (quantas >= 0),
  primary key (restaurante_id, dia)
);
alter table public.idas_de_demonstracao enable row level security; -- sem políticas: só as funções lhe mexem

-- 3. Marcar e desmarcar a ida de hoje (com as regras de segurança de quem chama)
create or replace function public.marcar_ida(restaurante uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.idas (restaurante_id) values (restaurante)
  on conflict (cliente_id, dia) do update set restaurante_id = excluded.restaurante_id, criado_em = now();
$$;

create or replace function public.desmarcar_ida()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  delete from public.idas where cliente_id = (select auth.uid()) and dia = (now() at time zone 'Europe/Lisbon')::date;
$$;

-- 4. Quantos estudantes vão hoje e quantos foram nos últimos 7 dias (só números, nunca quem)
create or replace function public.popularidade_dos_restaurantes(ids uuid[])
returns table (restaurante_id uuid, hoje integer, semana integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with contas as (
    select i.restaurante_id, i.dia, count(*)::integer as quantas
    from public.idas i
    where i.restaurante_id = any (ids) and i.dia > (now() at time zone 'Europe/Lisbon')::date - 7
    group by i.restaurante_id, i.dia
    union all
    select d.restaurante_id, d.dia, d.quantas
    from public.idas_de_demonstracao d
    where d.restaurante_id = any (ids) and d.dia > (now() at time zone 'Europe/Lisbon')::date - 7
  )
  select c.restaurante_id,
         coalesce(sum(c.quantas) filter (where c.dia = (now() at time zone 'Europe/Lisbon')::date), 0)::integer,
         sum(c.quantas)::integer
  from contas c
  where cardinality(ids) <= 500
  group by c.restaurante_id;
$$;

-- 5. Visitas simuladas para os 7 últimos dias dos restaurantes de demonstração: cada um tem a sua "fama"
--    (fixa) e um pouco de acaso por dia; ao fim de semana há menos estudantes. Só preenche o que falta.
create or replace function public.simular_idas_de_demonstracao()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
  dia_a_preencher date;
  inseridas integer := 0;
  agora integer;
begin
  for dia_a_preencher in select generate_series(hoje - 6, hoje, interval '1 day')::date loop
    insert into public.idas_de_demonstracao (restaurante_id, dia, quantas)
    select r.id,
           dia_a_preencher,
           greatest(0, (abs(hashtext(r.id::text)) % 9) + 2 + (abs(hashtext(r.id::text || dia_a_preencher::text)) % 6)
                       - case when extract(isodow from dia_a_preencher) >= 6 then 5 else 0 end)
    from public.restaurantes r
    join auth.users u on u.id = r.dono_id
    where u.email like 'demo-%@emmmenta-demo.pt'
    on conflict (restaurante_id, dia) do nothing;
    get diagnostics agora = row_count;
    inseridas := inseridas + agora;
  end loop;
  return inseridas;
end;
$$;

-- 6. Limpeza: nada fica guardado mais de 30 dias
create or replace function public.limpar_idas_antigas()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.idas where dia < (now() at time zone 'Europe/Lisbon')::date - 30;
  delete from public.idas_de_demonstracao where dia < (now() at time zone 'Europe/Lisbon')::date - 30;
$$;

-- Permissões: a app (com sessão) marca, desmarca e lê as contagens; o resto só a base de dados usa
revoke execute on function public.marcar_ida(uuid) from public, anon;
revoke execute on function public.desmarcar_ida() from public, anon;
revoke execute on function public.popularidade_dos_restaurantes(uuid[]) from public, anon;
grant execute on function public.marcar_ida(uuid) to authenticated;
grant execute on function public.desmarcar_ida() to authenticated;
grant execute on function public.popularidade_dos_restaurantes(uuid[]) to authenticated;
revoke execute on function public.simular_idas_de_demonstracao() from public, anon, authenticated;
revoke execute on function public.limpar_idas_antigas() from public, anon, authenticated;

-- Tarefas: simular as visitas de demonstração de hora a hora (só preenche o que falta) e limpar às 3h15 (UTC)
select cron.schedule('idas-de-demonstracao', '6 * * * *', $$select public.simular_idas_de_demonstracao()$$);
select cron.schedule('limpar-idas', '15 3 * * *', $$select public.limpar_idas_antigas()$$);

-- e preencher já a última semana da demonstração
select public.simular_idas_de_demonstracao();

-- 7. (migração "ranking_sem_acesso_direto_a_demonstracao") as visitas simuladas só são lidas pela função
--    popularidade_dos_restaurantes: a app não lhes acede diretamente.
revoke all on table public.idas_de_demonstracao from anon, authenticated;

-- Avisos do Supabase que são de propósito:
--   - "RLS Enabled No Policy" em idas_de_demonstracao: só as funções da base de dados lhe mexem.
--   - "Signed-In Users Can Execute SECURITY DEFINER Function" em popularidade_dos_restaurantes: tem de ver
--     as idas de todos para as contar (a RLS só deixa cada um ver as suas), mas só devolve números.
