import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadTelemetry } from '../lib/telemetry';
import type { TelemetryCard } from '../lib/types';

export interface MissionControlState {
  cards: TelemetryCard[];
  loading: boolean;
  connected: boolean;
  error: string | null;
  lastSync: string | null;
  refresh: () => Promise<void>;
}

export function useMissionControlFeed(): MissionControlState {
  const [cards, setCards] = useState<TelemetryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseReady) {
      setError('Supabase לא מוגדר. יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const nextCards = await loadTelemetry(120);
      setCards(nextCards);
      setLastSync(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load telemetry';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    const channel = client
      .channel('mission-control-agent-telemetry')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_telemetry' },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  return useMemo(
    () => ({ cards, loading, connected, error, lastSync, refresh }),
    [cards, connected, error, lastSync, loading, refresh],
  );
}
