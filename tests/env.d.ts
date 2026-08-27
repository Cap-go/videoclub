/// <reference path="../worker-configuration.d.ts" />

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    PROXY_URL?: string;
    YOUTUBE_API_KEY?: string;
    DATAFAST_API_KEY?: string;
    DATAFAST_SHARE_URL?: string;
  }
}

export {};
