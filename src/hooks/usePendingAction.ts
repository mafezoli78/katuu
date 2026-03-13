import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingAction, clearPendingAction } from '@/utils/pendingAction';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

const DEFAULT_INTENTION_ID = 'fe9396db-a8d8-4064-a5f5-c1220e6722f1';

export function usePendingAction() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /**
   * If a pending ACTIVATE_PRESENCE action exists, activate presence directly
   * via RPC and navigate to /home. Otherwise navigate to fallback.
   */
  const executePendingOrNavigate = useCallback(async (fallbackPath = '/location') => {
    const pending = getPendingAction();

    if (!pending || pending.type !== 'ACTIVATE_PRESENCE' || !pending.placeId || !user) {
      clearPendingAction();
      navigate(fallbackPath, { replace: true });
      return;
    }

    logger.debug(`[usePendingAction] 🔄 Executing pending action: place=${pending.placeId}`);
    clearPendingAction();

    try {
      const { data: presenceId, error } = await supabase.rpc('activate_presence', {
        p_place_id: pending.placeId,
        p_intention_id: DEFAULT_INTENTION_ID,
        p_assunto_atual: pending.expressionText?.trim() || null,
      });

      if (error) {
        logger.debug(`[usePendingAction] ❌ Activation failed: ${error.message}`);
        navigate(fallbackPath, { replace: true });
        return;
      }

      logger.debug(`[usePendingAction] ✅ Presence activated: ${presenceId}`);
      navigate('/home', { replace: true });
    } catch (err) {
      logger.debug('[usePendingAction] ❌ Unexpected error during activation');
      console.error('[usePendingAction]', err);
      navigate(fallbackPath, { replace: true });
    }
  }, [user, navigate]);

  return { executePendingOrNavigate };
}
