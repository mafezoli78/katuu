import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { InterestCategory } from '@/types/interests';

export function useInterestCategories() {
  const [categories, setCategories] = useState<InterestCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('interest_categories')
        .select(`
          id,
          name,
          sort_order,
          interests (
            id,
            name,
            slug,
            category_id,
            sort_order
          )
        `)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching interest categories:', error);
      } else {
        // Sort interests within each category by sort_order
        const sorted = (data || []).map((cat: any) => ({
          ...cat,
          interests: (cat.interests || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }));
        setCategories(sorted as InterestCategory[]);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  return { categories, loading };
}
