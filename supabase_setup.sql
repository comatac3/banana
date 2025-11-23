-- Robust Setup for Automatic Profile Creation

-- 1. Clean up previous attempts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS profiles (
    id uuid references auth.users on delete cascade not null primary key,
    email text,
    full_name text,
    avatar_url text,
    credits integer default 10 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (permissive for now to ensure it works)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;

CREATE POLICY "Public profiles are viewable by everyone." ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON profiles
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON profiles
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id);

-- 5. Create the Trigger Function (The most robust way)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits)
  VALUES (
    new.id, 
    new.email, 
    10
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 6. Create the Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Backfill for any existing users who missed the trigger
INSERT INTO profiles (id, email, credits)
SELECT id, email, 10
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 8. Assets table for storing generated images and videos
CREATE TABLE IF NOT EXISTS assets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    type text not null check (type in ('image', 'video')),
    url text not null,
    thumbnail_url text,
    prompt text,
    style text,
    model text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Enable RLS on assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- 10. Asset policies - users can only see and manage their own assets
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

CREATE POLICY "Users can view own assets" ON assets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON assets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON assets
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 11. Create index for faster queries
CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets(type);
CREATE INDEX IF NOT EXISTS assets_created_at_idx ON assets(created_at DESC);
