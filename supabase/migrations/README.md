# Supabase Migrations

This directory contains SQL migrations for the Supabase database.

## Public Profiles Migration

The `20250509_create_public_profiles.sql` file creates a new `public_profiles` table that stores user profile information, specifically usernames. This allows tour cards to display the creator's chosen username rather than a generic user ID.

### How to Apply the Migration

To apply this migration to your Supabase project:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a new query
4. Copy the contents of `20250509_create_public_profiles.sql` into the query editor
5. Run the query

### What This Migration Does

1. Creates a `public_profiles` table with the following columns:
   - `id`: UUID (primary key, references auth.users)
   - `username`: TEXT (the user's chosen username)
   - `created_at`: TIMESTAMP
   - `updated_at`: TIMESTAMP

2. Sets up Row Level Security (RLS) policies:
   - Anyone can view usernames (they're public)
   - Users can only update their own profile

3. Creates a trigger that automatically creates a profile entry when a new user signs up

4. Adds entries for existing users based on their email or metadata
