
-- Create bid collaborators table
CREATE TABLE public.bid_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.bid_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

ALTER TABLE public.bid_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner and existing collaborators can manage collaborators
CREATE POLICY "Owner can manage collaborators"
  ON public.bid_collaborators FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.bid_proposals bp WHERE bp.id = proposal_id AND bp.user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bid_proposals bp WHERE bp.id = proposal_id AND bp.user_id = auth.uid())
  );

-- Helper function: check if user is owner or collaborator
CREATE OR REPLACE FUNCTION public.is_bid_member(_user_id uuid, _proposal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bid_proposals WHERE id = _proposal_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.bid_collaborators WHERE proposal_id = _proposal_id AND user_id = _user_id
  )
$$;

-- Update bid_proposals RLS: drop old policy, create new ones
DROP POLICY IF EXISTS "Users can manage own proposals" ON public.bid_proposals;

CREATE POLICY "Owner can manage proposals"
  ON public.bid_proposals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Collaborators can view proposals"
  ON public.bid_proposals FOR SELECT
  USING (public.is_bid_member(auth.uid(), id));

CREATE POLICY "Collaborators can update proposals"
  ON public.bid_proposals FOR UPDATE
  USING (public.is_bid_member(auth.uid(), id));

-- Update proposal_sections RLS
DROP POLICY IF EXISTS "Users can manage own sections" ON public.proposal_sections;

CREATE POLICY "Members can manage sections"
  ON public.proposal_sections FOR ALL
  USING (public.is_bid_member(auth.uid(), proposal_id))
  WITH CHECK (public.is_bid_member(auth.uid(), proposal_id));

-- Update proposal_materials RLS
DROP POLICY IF EXISTS "Users can manage own materials" ON public.proposal_materials;

CREATE POLICY "Members can manage materials"
  ON public.proposal_materials FOR ALL
  USING (public.is_bid_member(auth.uid(), proposal_id))
  WITH CHECK (public.is_bid_member(auth.uid(), proposal_id));

-- Update audit_reports RLS to include collaborators
DROP POLICY IF EXISTS "Users can manage own audit reports" ON public.audit_reports;

CREATE POLICY "Members can manage audit reports"
  ON public.audit_reports FOR ALL
  USING (
    auth.uid() = user_id
    OR public.is_bid_member(auth.uid(), proposal_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_bid_member(auth.uid(), proposal_id)
  );
