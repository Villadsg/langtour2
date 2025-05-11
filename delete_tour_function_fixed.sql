-- Create a function to safely delete a tour and all related records
CREATE OR REPLACE FUNCTION delete_tour_safely(p_tour_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER -- This runs with the privileges of the function creator, bypassing RLS
AS $$
DECLARE
  is_creator BOOLEAN;
  is_admin BOOLEAN;
BEGIN
  -- Check if the user is the creator of the tour
  SELECT EXISTS (
    SELECT 1 FROM tours WHERE id = p_tour_id AND creator_id = p_user_id
  ) INTO is_creator;
  
  -- Check if the user has admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO is_admin;
  
  -- Only proceed if user is creator or admin
  IF is_creator OR is_admin THEN
    -- Delete all related records first
    -- This order ensures we don't violate foreign key constraints
    
    -- Delete ratings
    DELETE FROM ratings WHERE tour_id = p_tour_id;
    
    -- Delete notifications
    DELETE FROM notifications WHERE tour_id = p_tour_id;
    
    -- Delete bookings for all schedules of this tour
    DELETE FROM bookings 
    WHERE schedule_id IN (SELECT id FROM schedules WHERE tour_id = p_tour_id);
    
    -- Delete schedules
    DELETE FROM schedules WHERE tour_id = p_tour_id;
    
    -- Finally delete the tour itself
    DELETE FROM tours WHERE id = p_tour_id;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION delete_tour_safely TO authenticated;
