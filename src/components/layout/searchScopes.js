// src/components/layout/searchScopes.js
/** The search box's "All" selector: each choice is a ready-made listing. */
export const SEARCH_SCOPES = [
  { value: '', label: 'All', params: {} },
  { value: 'popular', label: 'Popular', params: { sort: 'popular' } },
  { value: 'new', label: 'New', params: { tag: 'new-season' } },
  { value: 'discounted', label: 'Discounted', params: { on_sale: '1' } },
  { value: 'top-rated', label: 'Top rated', params: { sort: 'rating' } },
  { value: 'featured', label: 'Featured', params: { featured: '1' } },
];

export const scopeFromParams = (params) =>
  SEARCH_SCOPES.find(
    (s) =>
      s.value && Object.entries(s.params).every(([k, v]) => params.get(k) === v)
  )?.value || '';
