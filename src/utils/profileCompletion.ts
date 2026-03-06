export function isProfileComplete(
  profile: { nome?: string | null; data_nascimento?: string | null } | null,
  interests: { length: number }
): boolean {
  return !!profile?.nome && !!profile?.data_nascimento && interests.length >= 3;
}
