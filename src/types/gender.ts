export type Gender = 'man' | 'woman' | 'non_binary' | 'other';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Homem' },
  { value: 'woman', label: 'Mulher' },
  { value: 'non_binary', label: 'Não-binário' },
  { value: 'other', label: 'Outro' },
];
