export function getToken(): string | undefined {
  return document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
}

export function getAuthHeaders(): { Authorization: string } | Record<string, never> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
