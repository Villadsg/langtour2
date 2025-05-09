CREATE OR REPLACE FUNCTION get_user_display_name(user_id_input uuid)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS 6353
  SELECT raw_user_meta_data->>'name'
  FROM auth.users
  WHERE id = user_id_input;
6353;
