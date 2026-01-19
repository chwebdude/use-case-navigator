import { useEffect, useState, useCallback } from 'react';
import type { RecordModel, RecordSubscription } from 'pocketbase';
import pb from '../lib/pocketbase';

interface UseRealtimeOptions {
  collection: string;
  filter?: string;
  sort?: string;
  expand?: string;
}

interface UseRealtimeResult<T> {
  records: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRealtime<T extends RecordModel>({
  collection,
  filter,
  sort,
  expand,
}: UseRealtimeOptions): UseRealtimeResult<T> {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const result = await pb.collection(collection).getFullList<T>({
        filter,
        sort,
        expand,
      });
      setRecords(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch records'));
    } finally {
      setLoading(false);
    }
  }, [collection, filter, sort, expand]);

  useEffect(() => {
    fetchRecords();

    // Subscribe to real-time updates
    let unsubscribe: (() => void) | undefined;

    pb.collection(collection)
      .subscribe<T>('*', async (event: RecordSubscription<T>) => {
        // For create/update, fetch the full record with expand data
        // since subscription events don't include expanded relations
        if ((event.action === 'create' || event.action === 'update') && expand) {
          try {
            const fullRecord = await pb.collection(collection).getOne<T>(event.record.id, { expand });
            setRecords((prev) => {
              if (event.action === 'create') {
                if (prev.some((r) => r.id === fullRecord.id)) {
                  return prev;
                }
                return [...prev, fullRecord];
              } else {
                return prev.map((r) => r.id === fullRecord.id ? fullRecord : r);
              }
            });
          } catch {
            // Record might have been deleted, ignore
          }
          return;
        }

        setRecords((prev) => {
          switch (event.action) {
            case 'create':
              // Check if record already exists to avoid duplicates
              if (prev.some((r) => r.id === event.record.id)) {
                return prev;
              }
              return [...prev, event.record];
            case 'update':
              return prev.map((r) =>
                r.id === event.record.id ? event.record : r
              );
            case 'delete':
              return prev.filter((r) => r.id !== event.record.id);
            default:
              return prev;
          }
        });
      })
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [collection, fetchRecords]);

  return { records, loading, error, refresh: fetchRecords };
}

export function useRecord<T extends RecordModel>(
  collection: string,
  id: string | undefined,
  expand?: string
) {
  const [record, setRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!id) {
      setRecord(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await pb.collection(collection).getOne<T>(id, { expand });
      setRecord(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch record'));
    } finally {
      setLoading(false);
    }
  }, [collection, id, expand]);

  useEffect(() => {
    fetchRecord();

    if (!id) return;

    // Subscribe to real-time updates for this specific record
    let unsubscribe: (() => void) | undefined;

    pb.collection(collection)
      .subscribe<T>(id, (event: RecordSubscription<T>) => {
        if (event.action === 'delete') {
          setRecord(null);
        } else {
          setRecord(event.record);
        }
      })
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [collection, id, fetchRecord]);

  return { record, loading, error, refresh: fetchRecord };
}
