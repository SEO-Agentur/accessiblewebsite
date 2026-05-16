/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

import type { Locale } from '@accessiblewebsite/shared';

declare global {
  namespace App {
    interface Locals {
      locale: Locale;
      host: string;
    }
  }
}

export {};
