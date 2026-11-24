import { useEffect, useState } from 'react'

type FetchState<T> = { data: T | null; error: Error | null; loading: boolean }

/**
 * Load data when `key` changes. The previous request is aborted, so a slow old response
 * can never overwrite a newer one (e.g. while typing a search or switching pages).
 */
export function useFetch<T>(loader: (signal: AbortSignal) => Promise<T>, key: string): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    loader(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false })
      })
    return () => controller.abort()
    // `loader` is a new function on every render; `key` says when the request really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  return { ...state, reload: () => setAttempt((n) => n + 1) }
}
