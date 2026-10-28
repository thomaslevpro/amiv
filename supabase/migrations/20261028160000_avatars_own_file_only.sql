-- Bucket avatars. Avant : "Avatar upload" / "Avatar update" autorisaient tout
-- utilisateur connecté à écrire n'importe quel fichier du bucket (donc à remplacer
-- l'avatar d'un autre), et aucune policy DELETE ne permettait de supprimer l'ancien
-- fichier quand l'extension change (.png → .jpg).
-- Après : chacun n'écrit, ne remplace et ne supprime que avatars/{auth.uid()}.{ext}
-- (racine du bucket, une seule extension alphanumérique). Lecture publique inchangée.

drop policy if exists "Avatar upload" on storage.objects;
drop policy if exists "Avatar update" on storage.objects;
drop policy if exists "Avatar delete" on storage.objects;

create policy "Avatar upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and name ~ ('^' || auth.uid()::text || '\.[A-Za-z0-9]+$'));

create policy "Avatar update" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and name ~ ('^' || auth.uid()::text || '\.[A-Za-z0-9]+$'))
with check (bucket_id = 'avatars' and name ~ ('^' || auth.uid()::text || '\.[A-Za-z0-9]+$'));

create policy "Avatar delete" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and name ~ ('^' || auth.uid()::text || '\.[A-Za-z0-9]+$'));
