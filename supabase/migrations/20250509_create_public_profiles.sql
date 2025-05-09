-- Create public_profiles table to store user profile information
CREATE TABLE IF NOT EXISTS public_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for the public_profiles table
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read any profile (public information)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public_profiles FOR SELECT 
USING (true);

-- Policy to allow users to update only their own profile
CREATE POLICY "Users can update their own profile" 
ON public_profiles FOR UPDATE 
USING (auth.uid() = id);

-- Policy to allow users to insert only their own profile
CREATE POLICY "Users can insert their own profile" 
ON public_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public_profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create a profile when a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing users
INSERT INTO public_profiles (id, username)
SELECT id, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;
