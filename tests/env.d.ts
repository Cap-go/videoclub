/// <reference path="../worker-configuration.d.ts" />

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    RESEND_API_KEY?: string;
  }
}

export {};
