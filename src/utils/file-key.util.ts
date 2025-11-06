import { randomUUID } from 'crypto';
import { extname } from 'path';

export function safeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[\-.]+|[\-.]+$/g, '')
    .toLowerCase();
}

export function makeStorageKey(prefix: string, originalName?: string): string {
  const id = randomUUID();
  const ext = originalName ? extname(originalName) : '';
  const name = originalName ? safeSlug(originalName.replace(ext, '')) : '';
  const file = name ? `${name}-${id}${ext}` : `${id}${ext}`;
  return [prefix.replace(/\/+$/, '').replace(/^\/+/, '').trim(), file].filter(Boolean).join('/');
}
