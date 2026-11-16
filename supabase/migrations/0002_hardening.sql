-- Sin auto-registro: los usuarios los crea un administrador.
drop policy if exists "auto perfil" on public.profiles;
-- Las funciones internas solo las ejecutan usuarios con sesión.
revoke execute on function public.claim_profile() from public, anon;
revoke execute on function public.gmm_role() from public, anon;
grant execute on function public.claim_profile() to authenticated;
grant execute on function public.gmm_role() to authenticated;
-- Administrador inicial (se enlaza con su cuenta Auth por correo en el primer ingreso).
insert into public.profiles (id, nombre, email, rol) values (gen_random_uuid(), 'Nicolás Schilling', 'n.schilling@glasstech.cl', 'admin')
on conflict (email) do update set rol = 'admin';
