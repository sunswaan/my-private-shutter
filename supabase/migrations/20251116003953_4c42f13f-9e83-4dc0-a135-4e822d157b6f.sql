-- Create photo versions table to store edit history
CREATE TABLE public.photo_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  edit_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.photo_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own photo versions"
ON public.photo_versions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own photo versions"
ON public.photo_versions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photo versions"
ON public.photo_versions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_photo_versions_photo_id ON public.photo_versions(photo_id);
CREATE INDEX idx_photo_versions_user_id ON public.photo_versions(user_id);