-- Language Learning Tours - Supabase Schema

-- ===============================
-- TABLE DEFINITIONS
-- ===============================

CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description JSONB NOT NULL,
  image_url TEXT, 
  creator_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  max_participants INTEGER NOT NULL,
  meeting_point TEXT NOT NULL,
  additional_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  participants INTEGER DEFAULT 1,
  notes TEXT,
  attended BOOLEAN DEFAULT FALSE,
  attended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table removed and attendance tracking moved to bookings table

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  language_learning_rating INTEGER,
  informative_rating INTEGER,
  fun_rating INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ===============================
-- SECURITY POLICIES
-- ===============================
-- Row Level Security (RLS) policies control who can perform which operations on rows in a table
-- Each policy has these components:
-- 1. A name (in quotes) describing what the policy does
-- 2. The table it applies to (ON table_name)
-- 3. The operation it controls (SELECT, INSERT, UPDATE, DELETE, or ALL)
-- 4. A condition that determines when the policy applies:
--    - USING clause: determines if existing rows are visible/accessible for operations
--    - WITH CHECK clause: determines if new/modified rows are allowed to be inserted/updated

-- Tours
-- This policy allows anyone (authenticated or not) to view tour information
CREATE POLICY "Tours are viewable by everyone" ON tours FOR SELECT USING (true);
-- This policy allows users to create tours only if they set themselves as the creator
-- auth.uid() returns the UUID of the currently authenticated user
CREATE POLICY "Users can create tours" ON tours FOR INSERT WITH CHECK (auth.uid() = creator_id);
-- This policy allows users to update only tours they created
CREATE POLICY "Creators can update their tours" ON tours FOR UPDATE USING (auth.uid() = creator_id);

-- This policy allows tour deletion by either:
-- 1. The original creator of the tour, OR
-- 2. Any user with the 'admin' role
-- The EXISTS subquery checks if the current user has an admin role entry in the user_roles table
CREATE POLICY "Creators can delete their tours" ON tours FOR DELETE USING (
  auth.uid() = creator_id OR 
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
-- Notifications
-- Create a single, simple policy for INSERT that works for both authenticated and anonymous users
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Add a policy for SELECT to allow viewing notifications
CREATE POLICY "Notifications are viewable by everyone" ON notifications FOR SELECT USING (true);

-- This policy allows only the creator of a tour to delete notifications related to that tour
CREATE POLICY "Tour creators can delete notifications" ON notifications FOR DELETE USING (auth.uid() IN (SELECT creator_id FROM tours WHERE id = tour_id));

-- Schedules
-- This policy allows anyone to view schedule information
CREATE POLICY "Schedules are viewable by everyone" ON schedules FOR SELECT USING (true);
-- This policy allows only the creator of a tour to add schedules for that tour
-- The subquery checks if the current user is the creator of the tour being scheduled
CREATE POLICY "Tour creators can create schedules" ON schedules FOR INSERT WITH CHECK (auth.uid() IN (SELECT creator_id FROM tours WHERE id = tour_id));
-- This policy allows only the creator of a tour to update schedules for that tour
-- The subquery verifies the current user is the creator of the associated tour
CREATE POLICY "Tour creators can update schedules" ON schedules FOR UPDATE USING (auth.uid() IN (SELECT creator_id FROM tours WHERE id = tour_id));
-- This policy allows only the creator of a tour to delete schedules for that tour
CREATE POLICY "Tour creators can delete schedules" ON schedules FOR DELETE USING (auth.uid() IN (SELECT creator_id FROM tours WHERE id = tour_id));

-- Bookings
-- This policy allows users to view only bookings they created themselves
-- It matches the authenticated user's ID with the user_id column in the bookings table
CREATE POLICY "Users can view their own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
-- This policy allows tour creators to view all bookings for their tours
-- The nested subqueries trace the relationship from booking → schedule → tour → creator
-- It finds the creator_id of the tour associated with the schedule of this booking
CREATE POLICY "Tour creators can view bookings" ON bookings FOR SELECT USING (auth.uid() IN (SELECT creator_id FROM tours WHERE id IN (SELECT tour_id FROM schedules WHERE id = schedule_id)));
-- This policy allows users to create bookings only for themselves
-- It ensures the user_id in the new booking matches the authenticated user's ID
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
-- This policy allows users to update only their own bookings
CREATE POLICY "Users can update their own bookings" ON bookings FOR UPDATE USING (auth.uid() = user_id);

-- This policy allows tour creators to update attendance status for bookings related to their tours
CREATE POLICY "Tour creators can update attendance" ON bookings FOR UPDATE USING (
  auth.uid() IN (SELECT creator_id FROM tours WHERE id IN (SELECT tour_id FROM schedules WHERE id = schedule_id))
);
-- This policy allows users to delete only their own bookings
CREATE POLICY "Users can delete their own bookings" ON bookings FOR DELETE USING (auth.uid() = user_id);

-- Attendance tracking policies (moved from participants to bookings table)

-- Ratings
-- This policy allows anyone to view all ratings
-- The condition 'true' means no restrictions apply to the SELECT operation
CREATE POLICY "Ratings are viewable by everyone" ON ratings FOR SELECT USING (true);
-- This policy allows users to create ratings only if they set themselves as the user
-- It ensures the user_id in the new rating matches the authenticated user's ID
CREATE POLICY "Users can create their own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
-- This policy allows users to update only ratings they created
CREATE POLICY "Users can update their own ratings" ON ratings FOR UPDATE USING (auth.uid() = user_id);
-- This policy allows users to delete only ratings they created
CREATE POLICY "Users can delete their own ratings" ON ratings FOR DELETE USING (auth.uid() = user_id);

-- User roles

-- Create a simpler approach to avoid recursion
-- Allow all operations for the superuser
CREATE POLICY "Superuser full access" ON user_roles 
  USING (auth.uid() = '00000000-0000-0000-0000-000000000000')
  WITH CHECK (auth.uid() = '00000000-0000-0000-0000-000000000000');

-- Allow users to see their own roles
CREATE POLICY "Users can view their own roles" ON user_roles 
  FOR SELECT USING (auth.uid() = user_id);

-- Create a special bypass policy for admin operations
-- This avoids the recursion by not checking the user_roles table itself
CREATE POLICY "Admin bypass for user_roles" ON user_roles
  USING (pg_has_role(auth.uid()::text, 'authenticated', 'member'))
  WITH CHECK (pg_has_role(auth.uid()::text, 'authenticated', 'member'));

-- ===============================
-- DATABASE FUNCTIONS
-- ===============================

-- Create a simplified function to check if a user has admin role without triggering RLS
CREATE OR REPLACE FUNCTION check_admin_role(input_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER -- This runs with the privileges of the function creator, bypassing RLS
AS $$
BEGIN
  -- Direct query that bypasses RLS with clearly named parameters to avoid ambiguity
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = input_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- ===============================
-- EMAIL NOTIFICATION FUNCTIONS
-- ===============================

-- Function to send rating notification emails when a booking is marked as attended
CREATE OR REPLACE FUNCTION send_rating_notification()
RETURNS TRIGGER AS $$
DECLARE
  tour_id UUID;
  tour_name TEXT;
  tour_data JSONB;
  rating_url TEXT;
  email_template TEXT;
BEGIN
  -- Only proceed if attendance status changed to true
  IF (NEW.attended = TRUE AND (OLD.attended IS NULL OR OLD.attended = FALSE)) THEN
    -- Get the tour ID from the schedule
    SELECT s.tour_id INTO tour_id
    FROM schedules s
    WHERE s.id = NEW.schedule_id;
    
    -- Get tour data to include in the email
    SELECT t.description INTO tour_data
    FROM tours t
    WHERE t.id = tour_id;
    
    -- Extract tour name from the description
    IF tour_data IS NOT NULL THEN
      IF jsonb_typeof(tour_data) = 'object' THEN
        tour_name := tour_data->>'name';
      ELSE
        -- Try to parse as JSON if it's stored as a string
        BEGIN
          tour_data := tour_data::jsonb;
          tour_name := tour_data->>'name';
        EXCEPTION WHEN OTHERS THEN
          tour_name := 'this tour';
        END;
      END IF;
      
      IF tour_name IS NULL THEN
        tour_name := 'this tour';
      END IF;
    ELSE
      tour_name := 'this tour';
    END IF;
    
    -- Create the rating URL - use a fallback domain if headers are not available
    BEGIN
      rating_url := 'https://' || current_setting('request.headers', true)::json->>'host' || '/tours/' || tour_id || '/rate';
    EXCEPTION WHEN OTHERS THEN
      -- Fallback to project URL if available, or a placeholder
      rating_url := 'https://yourdomain.com/tours/' || tour_id || '/rate';
    END;
    
    -- Create email template
    email_template := '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' ||
                     '<h2>Thank you for participating in ' || tour_name || '!</h2>' ||
                     '<p>Hello ' || NEW.name || ',</p>' ||
                     '<p>We hope you enjoyed your tour experience. Your feedback is valuable to us and helps improve future tours.</p>' ||
                     '<p>Please take a moment to rate your experience:</p>' ||
                     '<div style="text-align: center; margin: 30px 0;">' ||
                     '<a href="' || rating_url || '" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">' ||
                     'Rate This Tour' ||
                     '</a>' ||
                     '</div>' ||
                     '<p>You will be able to rate the tour on three dimensions:</p>' ||
                     '<ul>' ||
                     '<li>Language Learning</li>' ||
                     '<li>Informative Content</li>' ||
                     '<li>Fun Factor</li>' ||
                     '</ul>' ||
                     '<p>You can also leave optional comments about your experience.</p>' ||
                     '<p>Thank you for your participation!</p>' ||
                     '</div>';
    
    -- Use Supabase's built-in email functionality
    PERFORM auth.send_email(
      NEW.email,
      'Rate your experience on ' || tour_name,
      email_template
    );
    
    -- Insert a record in the notifications table
    INSERT INTO notifications (tour_id, email, created_at)
    VALUES (tour_id, NEW.email, NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to send rating notification emails when bookings are marked as attended
CREATE TRIGGER send_rating_notification_trigger
AFTER UPDATE OF attended ON bookings
FOR EACH ROW
EXECUTE FUNCTION send_rating_notification();

-- ===============================
-- STORAGE CONFIGURATION
-- ===============================
-- Run in Supabase dashboard SQL editor:
/*
-- Creates a storage bucket named 'tour-images' that is publicly accessible
INSERT INTO storage.buckets (id, name, public) VALUES ('tour-images', 'Tour Images', true);

-- This policy allows anyone to view images in the tour-images bucket
CREATE POLICY "Tour images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'tour-images');

-- This policy allows only authenticated users to upload images to the tour-images bucket
-- The auth.uid() IS NOT NULL condition ensures the user is authenticated
CREATE POLICY "Users can upload tour images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tour-images' AND auth.uid() IS NOT NULL);

-- This policy allows users to update only images they own in the tour-images bucket
-- The 'owner' field is automatically set to auth.uid() when files are uploaded
CREATE POLICY "Users can update their own images" ON storage.objects FOR UPDATE USING (bucket_id = 'tour-images' AND owner = auth.uid());

-- This policy allows users to delete only images they own in the tour-images bucket
CREATE POLICY "Users can delete their own images" ON storage.objects FOR DELETE USING (bucket_id = 'tour-images' AND owner = auth.uid());
*/
