-- =============================================================================
-- Proposta de alteração à base de dados — ideias novas (18 nov 2026)
-- Estado: PROPOSTA, AINDA NÃO APLICADA. O grupo decide antes (regra do projeto).
-- =============================================================================
--
-- O que muda e porquê:
--   1. pratos.ultimas_doses   o restaurante avisa "Últimas doses" antes de esgotar; os clientes veem
--                             logo (tempo real, como o esgotado).
--   2. menus.lotacao          "Há mesa" ou "Cheio agora", com a hora em que foi dito (lotacao_em);
--                             a app esconde o aviso ao fim de 45 minutos, para não mostrar coisas velhas.
--   3. pratos.foto_url        fotografia de cada prato (opcional), no bucket "fotos", na pasta da conta.
--   4. pratos.etiquetas       vegano, sem glúten, sem lactose, picante — e um filtro novo na lista.
--   5. pesquisa sem acentos   "salmao" passa a encontrar "Salmão" (hoje não encontra).
--   6. pratos_perto           devolve as colunas novas e aceita o filtro por etiqueta.
--
-- O que NÃO muda:
--   - As regras de segurança (RLS) ficam iguais e ligadas. As políticas que já existem cobrem as
--     colunas novas: o dono altera os seus pratos e menus, todos leem.
--   - O Storage fica igual: a política "fotos: enviar para a própria pasta" já deixa guardar
--     <id da conta>/pratos/<ficheiro>.jpg.
--   - A versão atual da app continua a funcionar: as colunas novas têm valor por omissão e o
--     parâmetro novo de pratos_perto é opcional.
--
-- Como aplicar: no painel do Supabase, SQL Editor → colar este ficheiro → Run (corre tudo de uma
-- vez, numa transação: ou fica tudo feito ou nada).
-- =============================================================================

begin;

-- 1. Últimas doses ------------------------------------------------------------
alter table public.pratos
  add column ultimas_doses boolean not null default false;

-- 2. Lotação ("Há mesa" / "Cheio agora") -----------------------------------------
alter table public.menus
  add column lotacao text check (lotacao in ('ha-mesa', 'cheio')),
  add column lotacao_em timestamptz;

-- A hora da lotação é sempre a do servidor (o relógio do telemóvel pode estar errado).
create function public.marcar_hora_da_lotacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.lotacao_em := case when new.lotacao is null then null else now() end;
  return new;
end;
$$;

create trigger lotacao_com_hora
  before insert or update of lotacao on public.menus
  for each row execute function public.marcar_hora_da_lotacao();

-- Os clientes veem a lotação mudar em tempo real (os pratos já estão nesta publicação).
alter publication supabase_realtime add table public.menus;

-- 3. Fotografia de cada prato ---------------------------------------------------
alter table public.pratos
  add column foto_url text;

-- 4. Etiquetas -------------------------------------------------------------------
alter table public.pratos
  add column etiquetas text[] not null default '{}'
    check (etiquetas <@ array['vegano', 'sem-gluten', 'sem-lactose', 'picante']);

-- 5. Pesquisa sem acentos --------------------------------------------------------
-- "Salmão" → "salmao". Função simples (sem extensões), sempre com o mesmo resultado (immutable).
create function public.sem_acentos(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(texto), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

-- 6. pratos_perto com as colunas novas -------------------------------------------
-- Muda o que a função devolve, por isso tem de ser apagada e criada outra vez (dentro da mesma
-- transação: a app nunca a vê desaparecer).
drop function public.pratos_perto(double precision, double precision, double precision, numeric, text, text);

create function public.pratos_perto(
  lat double precision,
  lng double precision,
  raio_km double precision default 5,
  preco_max numeric default null,
  categoria_filtro text default null,
  pesquisa text default null,
  etiqueta_filtro text default null
)
returns table (
  prato_id uuid,
  prato text,
  categoria text,
  preco numeric,
  esgotado boolean,
  ultimas_doses boolean,
  etiquetas text[],
  foto_url text,
  menu_id uuid,
  lotacao text,
  lotacao_em timestamptz,
  restaurante_id uuid,
  restaurante text,
  latitude double precision,
  longitude double precision,
  distancia_km double precision
)
language sql
stable
set search_path = ''
as $function$
  select t.prato_id, t.prato, t.categoria, t.preco, t.esgotado,
         t.ultimas_doses, t.etiquetas, t.foto_url,
         t.menu_id, t.lotacao, t.lotacao_em,
         t.restaurante_id, t.restaurante, t.latitude, t.longitude, t.distancia_km
  from (
    select p.id as prato_id,
           p.nome as prato,
           p.categoria,
           p.preco,
           p.esgotado,
           p.ultimas_doses,
           p.etiquetas,
           p.foto_url,
           m.id as menu_id,
           m.lotacao,
           m.lotacao_em,
           r.id as restaurante_id,
           r.nome as restaurante,
           r.latitude,
           r.longitude,
           6371 * 2 * asin(sqrt(
             power(sin(radians(r.latitude - lat) / 2), 2)
             + cos(radians(lat)) * cos(radians(r.latitude)) * power(sin(radians(r.longitude - lng) / 2), 2)
           )) as distancia_km
    from public.pratos p
    join public.menus m on m.id = p.menu_id
    join public.restaurantes r on r.id = m.restaurante_id
    where m.dia = (now() at time zone 'Europe/Lisbon')::date
      and r.latitude is not null
      and r.longitude is not null
      and (preco_max is null or p.preco <= preco_max)
      and (categoria_filtro is null or p.categoria = categoria_filtro)
      and (pesquisa is null or public.sem_acentos(p.nome) like '%' || public.sem_acentos(pesquisa) || '%')
      and (etiqueta_filtro is null or etiqueta_filtro = any (p.etiquetas))
  ) t
  where t.distancia_km <= raio_km
  order by t.esgotado, t.distancia_km, t.preco;
$function$;

grant execute on function public.pratos_perto(double precision, double precision, double precision, numeric, text, text, text)
  to anon, authenticated;

commit;

-- =============================================================================
-- Para desfazer (se o grupo mudar de ideias):
--   alter publication supabase_realtime drop table public.menus;
--   drop trigger lotacao_com_hora on public.menus;  drop function public.marcar_hora_da_lotacao();
--   alter table public.pratos drop column ultimas_doses, drop column foto_url, drop column etiquetas;
--   alter table public.menus drop column lotacao, drop column lotacao_em;
--   e voltar a criar a versão anterior de pratos_perto (sem as colunas novas nem etiqueta_filtro);
--   por fim, drop function public.sem_acentos(text);
-- =============================================================================
