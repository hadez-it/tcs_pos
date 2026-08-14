-- Create an RPC to securely delete a user from auth.users
create or replace function delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete the user from auth.users (this will cascade to profiles if configured, but we do it manually just in case)
  delete from auth.users where id = target_user_id;
  delete from public.profiles where id = target_user_id;
end;
$$;
