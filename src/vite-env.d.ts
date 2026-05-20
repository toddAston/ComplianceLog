/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL used to construct contractor invite links. Trailing slash is
   * stripped. Defaults to "https://fieldlog.invite" when unset.
   */
  readonly VITE_INVITE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
