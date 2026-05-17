/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

import type { Locale } from '@accessiblewebsite/shared';
import type { User } from '@accessiblewebsite/db';

declare global {
  namespace App {
    interface Locals {
      locale: Locale;
      host: string;
      user: User | null;
      bypassRateLimit: boolean;
    }
  }
}

export {};
