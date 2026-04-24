export function getToken(): string | undefined {
  return document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
}

export function getAuthHeaders(): { Authorization: string } | Record<string, never> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface UserProfile {
  staff_id?: number | string;
  fullname?: string;
  ward_code?: string;
  ward_name?: string;
  [key: string]: any;
}

export function getUserProfile(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem('user_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
