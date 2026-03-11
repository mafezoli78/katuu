import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseTutorialReturn {
  shouldShowTutorial: boolean;
  loading: boolean;
  dismissTutorial: () => void;
}

/**
 * Controla a exibição do tutorial.
 *
 * Usa a coluna `tutorial_enabled` (boolean, default: true) que já existe
 * na tabela profiles — não requer nenhuma migration adicional.
 *
 * Lógica:
 * - true  → mostra tutorial
 * - false → não mostra
 *
 * Ao concluir/pular, grava tutorial_enabled = false no banco.
 */
export function useTutorial(): UseTutorialReturn {
  const { user } = useAuth();
  const [shouldShowTutorial, setShouldShowTutorial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkTutorial = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_enabled')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[useTutorial] Error fetching tutorial status:', error);
          setShouldShowTutorial(false);
          return;
        }

        // tutorial_enabled = true (ou null por segurança) → mostrar tutorial
        setShouldShowTutorial(data?.tutorial_enabled !== false);
      } finally {
        setLoading(false);
      }
    };

    checkTutorial();
  }, [user]);

  const dismissTutorial = async () => {
    setShouldShowTutorial(false); // atualiza UI imediatamente

    if (!user) return;
    await supabase
      .from('profiles')
      .update({ tutorial_enabled: false })
      .eq('id', user.id);
  };

  return { shouldShowTutorial, loading, dismissTutorial };
}
