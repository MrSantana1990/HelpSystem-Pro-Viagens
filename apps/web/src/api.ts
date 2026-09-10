let csrfToken = '';
let identityEpoch = 0;
export function setCsrf(value: string) {
  if (csrfToken !== value) identityEpoch++;
  csrfToken = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const epoch = identityEpoch;
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(!['GET', 'HEAD'].includes(method) && csrfToken
        ? { 'x-csrf-token': csrfToken }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (epoch !== identityEpoch)
    throw new ApiError('A sessão mudou. Atualize a página.', 409);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.endsWith('/login'))
      window.dispatchEvent(new Event('viagens:session-expired'));
    throw new ApiError(
      data.error?.message ?? 'Não foi possível concluir. Tente novamente.',
      response.status,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
