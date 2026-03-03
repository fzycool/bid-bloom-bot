
-- Add TOC generation tracking columns to bid_proposals
ALTER TABLE public.bid_proposals
ADD COLUMN toc_status text NOT NULL DEFAULT 'pending',
ADD COLUMN toc_progress text NULL;
