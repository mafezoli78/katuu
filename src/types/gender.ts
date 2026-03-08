export type Gender =
  | 'man'
  | 'woman'
  | 'non_binary'
  | 'trans_man'
  | 'trans_woman'
  | 'agender'
  | 'genderfluid'
  | 'prefer_not_to_say'
  | 'other';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Homem' },
  { value: 'woman', label: 'Mulher' },
  { value: 'non_binary', label: 'Não-binário' },
  { value: 'trans_man', label: 'Homem trans' },
  { value: 'trans_woman', label: 'Mulher trans' },
  { value: 'agender', label: 'Agênero' },
  { value: 'genderfluid', label: 'Gênero fluido' },
  { value: 'prefer_not_to_say', label: 'Prefiro não dizer' },
  { value: 'other', label: 'Outro' },
];
