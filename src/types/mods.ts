import type { AnnKind } from '../services/announcements';

export const SUPPORTED_MOD_TYPES = ['announcement-templates', 'pronunciation-dictionary'] as const;
export type ModType = (typeof SUPPORTED_MOD_TYPES)[number];

export interface ModManifest {
  id: string;
  name: string;
  author: string;
  version: string;
  type: ModType;
  source: string;
  description?: string;
  compatibility?: { hubMin?: string; hubMax?: string };
}

export interface InstalledMod extends ModManifest {
  enabled: boolean;
  installedAt: number;
  compatible: boolean;
  compatibilityNote: string | null;
}

export type ModsResult<T = InstalledMod[]> = { ok: true; data: T; message?: string } | { ok: false; error: string };

export interface ActiveModContent {
  templates: Partial<Record<'cs' | 'pl', Partial<Record<AnnKind, string>>>>;
  pronunciations: { word: string; spoken: string }[];
}
