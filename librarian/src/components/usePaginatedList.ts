import { useCallback, useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import { readAPI } from './api';

export function usePaginatedList<T>(
  path: string, listField: string, totalField: string, search: string,
  filters = '', pageSize = 20,
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  const [pageState, setPageState] = useState({ filter: '', number: 1 });
  const [revision, setRevision] = useState(0);
  const filter = new URLSearchParams(filters);
  if (debouncedSearch) filter.set('search', debouncedSearch);
  const filterKey = filter.toString();
  const currentPage = pageState.filter === filterKey ? pageState.number : 1;

  const setCurrentPage = useCallback((next: SetStateAction<number>) => {
    setPageState(previous => ({
      filter: filterKey,
      number: typeof next === 'function' ? next(previous.filter === filterKey ? previous.number : 1) : next,
    }));
  }, [filterKey]);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPageState(previous => previous.filter === filterKey ? previous : { filter: filterKey, number: 1 });
  }, [filterKey]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = new URLSearchParams(filterKey);
    params.set('limit', String(pageSize));
    params.set('offset', String((currentPage - 1) * pageSize));

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const data = await readAPI<Record<string, T[] | number | undefined>>(`${path}?${params}`, { signal });
        if (signal.aborted) return;
        const pageTotal = data[totalField];
        const pageItems = data[listField];
        const count = typeof pageTotal === 'number' ? pageTotal : 0;
        setItems(Array.isArray(pageItems) ? pageItems : []);
        setTotal(count);
        const lastPage = Math.max(1, Math.ceil(count / pageSize));
        if (currentPage > lastPage) setCurrentPage(lastPage);
      } catch (err) {
        if (!signal.aborted) {
          console.error('Failed to load records:', err);
          setError(true);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [currentPage, filterKey, listField, pageSize, path, revision, setCurrentPage, totalField]);

  return { items, total, loading, error, currentPage, setCurrentPage, reload };
}
