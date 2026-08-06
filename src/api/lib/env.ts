export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  AI: Ai;
  APP_NAME: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: { userEmail: string };
};
