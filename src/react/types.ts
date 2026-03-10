/** Standard return type for data-fetching hooks */
export interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
