-- Enable realtime for photos table so changes sync across devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;