
-- Create company_materials table
CREATE TABLE public.company_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT,
  ai_status TEXT NOT NULL DEFAULT 'pending',
  content_description TEXT,
  material_type TEXT,
  issuing_authority TEXT,
  certificate_number TEXT,
  expire_at DATE,
  issued_at DATE,
  ai_extracted_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_materials ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own materials"
ON public.company_materials FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own materials"
ON public.company_materials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own materials"
ON public.company_materials FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own materials"
ON public.company_materials FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all materials"
ON public.company_materials FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_company_materials_updated_at
BEFORE UPDATE ON public.company_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-materials', 'company-materials', true);

-- Storage policies
CREATE POLICY "Users can upload own company materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own company materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own company materials"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view company materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-materials');
