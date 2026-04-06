
-- Add type column to nodes (keyword or detailed_keyword)
ALTER TABLE public.nodes ADD COLUMN type text NOT NULL DEFAULT 'keyword';

-- Add parent_id for hierarchy (DetailedKeyword → parent Keyword or DetailedKeyword)
ALTER TABLE public.nodes ADD COLUMN parent_id uuid REFERENCES public.nodes(id) ON DELETE SET NULL;

-- Index for faster hierarchy queries
CREATE INDEX idx_nodes_parent_id ON public.nodes(parent_id);
CREATE INDEX idx_nodes_type ON public.nodes(type);
