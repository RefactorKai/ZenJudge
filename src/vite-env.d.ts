/// <reference types="vite/client" />

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

interface Window {
  __TAURI_INTERNALS__?: Record<string, unknown>;
}
