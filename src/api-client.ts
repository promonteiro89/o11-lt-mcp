import axios, { AxiosError, AxiosInstance } from "axios";

/** Shape of the LifeTime API error body */
export interface LifeTimeException {
  Errors: string[];
  StatusCode: number;
}

/**
 * Rich error class that surfaces the LifeTime `Errors` array verbatim so the
 * LLM knows exactly why an operation failed (e.g. "Deployment blocked due to
 * missing dependencies").
 */
export class LifeTimeAPIError extends Error {
  constructor(
    public readonly errors: string[],
    public readonly statusCode: number
  ) {
    super(`LifeTime API Error [${statusCode}]: ${errors.join("; ")}`);
    this.name = "LifeTimeAPIError";
  }
}

/** Shared error interceptor — surfaces the OutSystems Errors array verbatim */
function attachErrorInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        const data = error.response.data as Partial<LifeTimeException> | null;
        const errors: string[] =
          Array.isArray(data?.Errors) && data!.Errors.length > 0
            ? data!.Errors
            : [`HTTP ${error.response.status}: ${error.message}`];
        const statusCode =
          typeof data?.StatusCode === "number"
            ? data.StatusCode
            : error.response.status;
        throw new LifeTimeAPIError(errors, statusCode);
      }
      throw error;
    }
  );
}

/** LifeTime API client — Bearer token auth */
export function createApiClient(baseURL: string, token?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    // LifeTime deployments can be slow — give generous timeouts
    timeout: 120_000,
  });
  attachErrorInterceptor(client);
  return client;
}
