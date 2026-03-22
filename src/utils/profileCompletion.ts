export function isProfileComplete(
  profile: { nome?: string | null; data_nascimento?: string | null; gender?: string | null } | null,
  interests: { length: number }
): boolean {
  return !!profile?.nome && !!profile?.data_nascimento && !!profile?.gender && interests.length >= 3;
}