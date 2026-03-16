-- Task table for Bidding Assistant Plus
CREATE TABLE public.bidding_plus_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_name text NOT NULL DEFAULT '未命名任务',
  outline_data jsonb DEFAULT '[]'::jsonb,
  current_step integer NOT NULL DEFAULT 1,
  bid_analysis_id uuid REFERENCES public.bid_analyses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bidding_plus_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tasks" ON public.bidding_plus_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_bidding_plus_tasks_updated_at
  BEFORE UPDATE ON public.bidding_plus_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sheet table: each tab in the editor
CREATE TABLE public.bidding_plus_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.bidding_plus_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '未命名',
  content text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  source_material_id uuid REFERENCES public.company_materials(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bidding_plus_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sheets" ON public.bidding_plus_sheets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_bidding_plus_sheets_updated_at
  BEFORE UPDATE ON public.bidding_plus_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();