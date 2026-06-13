// Resolves the image URI to show for a user: their uploaded profile photo if
// set, otherwise a stable generated placeholder keyed by their id (so everyone
// without a photo still gets a consistent, distinct default).
export function avatarUri(
  user?: { id?: string; avatar?: string | null } | null,
  fallbackId?: string,
): string {
  if (user?.avatar) return user.avatar;
  const id = user?.id ?? fallbackId ?? 'anon';
  return `https://i.pravatar.cc/150?u=${id}`;
}
