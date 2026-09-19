import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';

// Fallback keeps the pickers usable if the backend is unreachable.
const FALLBACK_CATEGORIES = [
  'Architectural',
  'Interior Designing',
  'False Ceiling',
  'Painting',
  'Furniture',
  'Lighting',
  'Landscaping',
  'Other'
];

export function useCategories() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authFetch('/categories');
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Could not load categories:', err);
      }
    })();
    return () => { active = false; };
  }, []);

  return categories;
}

export default useCategories;
