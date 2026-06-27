export async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    return null;
  }

  // JSON is expected to be UTF-8; decode explicitly to avoid charset guess issues.
  const text = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(text) as T;
}
