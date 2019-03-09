export interface LemmaRow {
  id: number;
  language_id: number;
  term_unique: string;
  term_display: string;
}

export const enum LemmaFilter {
  ALL_LEMMAS = 'ALL_LEMMAS',
  DEFINED_LEMMAS_ONLY = 'DEFINED_LEMMAS_ONLY',
  DERIVED_LEMMAS_ONLY = 'DERIVED_LEMMAS_ONLY',
}