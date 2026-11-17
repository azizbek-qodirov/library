import type { Message } from '../../../shared/i18n';
import { API_BASE_URL } from './types';

let authorization: string | undefined;

export class StaffSignInError extends Error {
  readonly key: Message;

  constructor(key: Message) {
    super(key);
    this.key = key;
  }
}

export async function signIn(username: string, password: string) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const credentials = `Basic ${btoa(String.fromCharCode(...bytes))}`;
  const response = await fetch(`${API_BASE_URL}/staff/session`, {
    headers: { Authorization: credentials },
  });
  if (response.status === 503) throw new StaffSignInError('Staff access has not been configured.');
  if (!response.ok) throw new StaffSignInError('Sign-in failed. Check your username and password.');
  authorization = credentials;
}

export function signOut() {
  authorization = undefined;
}

export function staffFetch(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  if (authorization) headers.set('Authorization', authorization);
  return fetch(url, { ...options, headers, redirect: 'error' });
}

export async function readAPI<T = void>(path: string, options?: RequestInit): Promise<T> {
  const response = await staffFetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const body: { error?: string; details?: string } | null = await response.json().catch(() => null);
    throw new Error(body?.details || body?.error || `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
