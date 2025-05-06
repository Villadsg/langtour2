import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Create a mock client for when credentials aren't available
const createMockClient = () => {
  console.error('Supabase URL or anon key not properly configured');
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') }),
      signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({ error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        in: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        gt: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        order: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        })
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
          })
        })
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: new Error('Supabase not configured') })
      })
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        remove: () => Promise.resolve({ error: new Error('Supabase not configured') }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  };
};

// Check if we have valid credentials before creating the client
let supabase: SupabaseClient;
if (!supabaseUrl.includes('your-project-url') && !supabaseKey.includes('your-anon-key')) {
  console.log('Creating Supabase client with provided credentials');
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  supabase = createMockClient() as unknown as SupabaseClient;
}

export { supabase };
