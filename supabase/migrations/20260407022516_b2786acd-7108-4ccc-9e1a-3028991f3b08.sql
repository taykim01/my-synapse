
-- Add embedding column to nodes table
ALTER TABLE public.nodes ADD COLUMN embedding extensions.vector(1536);

-- Create function to match nodes by embedding similarity
CREATE OR REPLACE FUNCTION public.match_nodes(
  query_embedding extensions.vector,
  match_threshold double precision,
  match_count integer,
  user_id uuid
)
RETURNS TABLE(id uuid, title text, type text, parent_id uuid, similarity double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.type,
    n.parent_id,
    1 - (n.embedding OPERATOR(extensions.<=>) query_embedding)::FLOAT AS similarity
  FROM public.nodes n
  WHERE n.creator_id = user_id
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding OPERATOR(extensions.<=>) query_embedding)::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
