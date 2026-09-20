export async function getData(path, signal) {
  const response = await fetch(`/api/${path}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'The prediction service is unavailable. Please try again.');
  }
  return response.json();
}
