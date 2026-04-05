
CREATE OR REPLACE FUNCTION public.search_captures(query_text text, user_id uuid)
 RETURNS SETOF captures
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select * from captures
  where creator_id = user_id
    and to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
        @@ plainto_tsquery('english', query_text)
  order by created_at desc
  limit 20;
$function$;

CREATE OR REPLACE FUNCTION public.match_captures(query_embedding vector, match_threshold double precision, match_count integer, user_id uuid)
 RETURNS TABLE(id uuid, title text, body text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select id, title, description as body,
         1 - (embedding <=> query_embedding) as similarity
  from captures
  where creator_id = user_id
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$function$;
