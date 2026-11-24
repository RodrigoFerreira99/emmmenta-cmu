-- =============================================================================
-- Alteração à base de dados — menus de demonstração publicados pelo próprio Supabase (24 nov 2026)
-- Estado: APLICADA a 24 nov 2026 (migração "menus_de_demonstracao_automaticos"), depois do OK do Rodrigo.
-- =============================================================================
--
-- Porquê:
--   A tarefa do GitHub "Publicar os menus de demonstração" está marcada para as 6h30 (UTC), mas o GitHub
--   tem-na corrido com muito atraso (de 19 a 23 nov correu entre as 14h45 e as 18h30). Até lá, os
--   restaurantes de demonstração não têm menu e quem abre a app vê a lista vazia.
--
-- O que muda:
--   1. Liga-se o pg_cron (o agendador de tarefas do Postgres, que o Supabase já traz).
--   2. Função publicar_menus_de_demonstracao(): para cada restaurante de demonstração (contas
--      demo-…@emmmenta-demo.pt, criadas por scripts/demonstracao.mjs) que ainda não tenha menu hoje,
--      copia o menu de há 2 dias (os restaurantes de demonstração alternam entre dois menus, como o
--      script) ou, se não houver, o último que houver. Os pratos copiados começam sem "esgotado" nem
--      "últimas doses". Devolve quantos menus publicou.
--   3. Tarefa "menus-de-demonstracao": chama a função de hora a hora (ao minuto 5). Como só publica
--      quando falta o menu do dia, na prática os menus aparecem logo a seguir à meia-noite de Lisboa.
--
-- O que NÃO muda:
--   - As regras de segurança (RLS) ficam iguais e ligadas. A função corre com os direitos do dono da
--     base de dados (security definer), mas só mexe nos restaurantes de demonstração e ninguém a pode
--     chamar de fora: os papéis anon e authenticated não a podem executar.
--   - A tarefa do GitHub continua (serve de reserva): o script substitui o menu do dia se já existir,
--     por isso os dois não se atrapalham.
--   - Os restaurantes verdadeiros nunca são tocados.
--
-- Como desfazer:
--   select cron.unschedule('menus-de-demonstracao');
--   drop function public.publicar_menus_de_demonstracao();
--   (e, se não houver outras tarefas: drop extension pg_cron;)
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.publicar_menus_de_demonstracao()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
  restaurante uuid;
  modelo uuid;
  novo uuid;
  publicados integer := 0;
begin
  for restaurante in
    select r.id
    from public.restaurantes r
    join auth.users u on u.id = r.dono_id
    where u.email like 'demo-%@emmmenta-demo.pt'
  loop
    -- já tem menu hoje (publicado pelo script ou por esta função): não se mexe
    if exists (select 1 from public.menus m where m.restaurante_id = restaurante and m.dia = hoje) then
      continue;
    end if;

    -- o menu de há 2 dias (a mesma "variante" que o script publicaria hoje); senão, o último que houver
    select m.id into modelo
    from public.menus m
    where m.restaurante_id = restaurante and m.dia < hoje
    order by (m.dia = hoje - 2) desc, m.dia desc
    limit 1;
    if modelo is null then
      continue;
    end if;

    begin
      -- o dia fica o de hoje em Lisboa (valor por omissão da coluna, como em qualquer menu: RN01)
      insert into public.menus (restaurante_id, preco_menu_completo)
      select m.restaurante_id, m.preco_menu_completo from public.menus m where m.id = modelo
      returning id into novo;

      -- os pratos, pela mesma ordem (a hora de criação desempata a ordem dentro de cada categoria)
      insert into public.pratos (menu_id, nome, categoria, preco, etiquetas, foto_url, criado_em)
      select novo, p.nome, p.categoria, p.preco, p.etiquetas, p.foto_url,
             now() + (row_number() over (order by p.criado_em, p.nome)) * interval '1 millisecond'
      from public.pratos p
      where p.menu_id = modelo;

      publicados := publicados + 1;
    exception when unique_violation then
      -- o script do GitHub publicou o menu ao mesmo tempo: fica o dele
      null;
    end;
  end loop;

  return publicados;
end;
$$;

-- ninguém de fora a pode chamar (nem pela chave pública, nem com sessão iniciada)
revoke execute on function public.publicar_menus_de_demonstracao() from public, anon, authenticated;

-- de hora a hora, ao minuto 5 (se a tarefa já existir, só muda o horário)
select cron.schedule('menus-de-demonstracao', '5 * * * *', $$select public.publicar_menus_de_demonstracao()$$);
