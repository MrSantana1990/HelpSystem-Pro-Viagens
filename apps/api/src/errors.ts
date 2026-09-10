export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = () =>
  new HttpError(404, 'NOT_FOUND', 'Recurso não encontrado.');
