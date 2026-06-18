/**
 * Raio de entrada ("Aqui") por categoria do place.
 * Categorias diferentes pedem folgas de GPS diferentes: um bar pequeno
 * precisa de precisão maior que um parque.
 */

export const CATEGORY_RADIUS_SMALL_METERS = 75;
export const CATEGORY_RADIUS_MEDIUM_METERS = 150;
export const CATEGORY_RADIUS_LARGE_METERS = 300;

function normalize(categoria: string): string {
  return categoria
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const SMALL_RADIUS_CATEGORIES = new Set([
  'american restaurant', 'argentinian restaurant', 'brazilian restaurant',
  'chinese restaurant', 'french restaurant', 'greek restaurant',
  'italian restaurant', 'japanese restaurant', 'mediterranean restaurant',
  'middle eastern restaurant', 'seafood restaurant', 'sushi restaurant',
  'tapas restaurant', 'restaurant', 'bbq joint', 'bistro', 'breakfast spot',
  'burger joint', 'churrascaria', 'diner', 'gastropub', 'pizzeria',
  'steakhouse', 'bar', 'dive bar', 'beer garden', 'brewery', 'hookah bar',
  'irish pub', 'lounge', 'night club', 'pub', 'rock club', 'speakeasy',
  'wine bar', 'cafe', 'coffee shop', 'bubble tea shop', 'wine store',
  'arcade', 'pool hall',
].map(normalize));

const MEDIUM_RADIUS_CATEGORIES = new Set([
  'arts and entertainment', 'movie theater', 'music venue',
  'performing arts venue', 'theater', 'shopping mall', 'bowling alley',
].map(normalize));

const LARGE_RADIUS_CATEGORIES = new Set([
  'amusement park', 'dog park', 'mountain', 'park', 'playground', 'plaza',
  'race track', 'skate park', 'ski chairlift', 'ski resort and area',
  'soccer field', 'soccer stadium', 'swimming pool', 'sports and recreation',
  'hot spring',
].map(normalize));

/**
 * Retorna o raio de entrada (em metros) para a categoria informada.
 * Locais temporários (sem categoria do Foursquare) usam a faixa grande.
 * Categoria null/desconhecida cai no fallback médio.
 */
export function getCategoryRadius(categoria: string | null, isTemporary = false): number {
  if (isTemporary) return CATEGORY_RADIUS_LARGE_METERS;
  if (!categoria) return CATEGORY_RADIUS_MEDIUM_METERS;

  const normalized = normalize(categoria);
  if (SMALL_RADIUS_CATEGORIES.has(normalized)) return CATEGORY_RADIUS_SMALL_METERS;
  if (MEDIUM_RADIUS_CATEGORIES.has(normalized)) return CATEGORY_RADIUS_MEDIUM_METERS;
  if (LARGE_RADIUS_CATEGORIES.has(normalized)) return CATEGORY_RADIUS_LARGE_METERS;
  return CATEGORY_RADIUS_MEDIUM_METERS;
}
