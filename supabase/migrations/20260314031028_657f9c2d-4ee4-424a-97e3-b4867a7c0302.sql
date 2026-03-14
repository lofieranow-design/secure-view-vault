
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read user_roles
CREATE POLICY "Admins can read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Access codes table
CREATE TABLE public.access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  timer_duration INTEGER NOT NULL DEFAULT 60, -- in minutes
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage access_codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anon to select for code validation (limited by edge function)
CREATE POLICY "Anyone can validate codes" ON public.access_codes
  FOR SELECT TO anon, authenticated
  USING (true);

-- Files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  filetype TEXT NOT NULL,
  filesize BIGINT,
  storage_path TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage files" ON public.files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Code-file mappings
CREATE TABLE public.code_file_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES public.access_codes(id) ON DELETE CASCADE NOT NULL,
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (code_id, file_id)
);
ALTER TABLE public.code_file_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mappings" ON public.code_file_mappings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read mappings" ON public.code_file_mappings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Viewer sessions
CREATE TABLE public.viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES public.access_codes(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.viewer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read own sessions" ON public.viewer_sessions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage sessions" ON public.viewer_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  code_id UUID REFERENCES public.access_codes(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.viewer_sessions(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read activity" ON public.activity_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anon can insert activity" ON public.activity_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Storage bucket for digital products (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-products', 'digital-products', false);

-- Only admins can upload/manage files in storage
CREATE POLICY "Admins can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-products' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'digital-products' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'digital-products' AND public.has_role(auth.uid(), 'admin'));

-- Service role can read files (for edge functions)
CREATE POLICY "Service role can read digital products" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'digital-products');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
