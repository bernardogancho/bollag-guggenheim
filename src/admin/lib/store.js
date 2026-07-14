import { deepClone } from './paths.js';

export const DRAFT_PREFIX = 'bg-cms-draft:';

// One store instance holds every content file: { remote, draft }.
// Drafts persist to localStorage while they differ from remote; UI subscribes
// via subscribe/getVersion (React: useSyncExternalStore).
export function createStore() {
  const files = new Map();
  const listeners = new Set();
  let version = 0;

  const emit = () => {
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  };

  // Equality is JSON.stringify-based; mutations must preserve key order
  // (clone-then-mutate does). Do not rebuild objects with reordered keys.
  // localStorage failures (quota, private browsing) are swallowed so they can
  // never prevent emit() from running — drafts then live only in memory.
  const persist = filePath => {
    const entry = files.get(filePath);
    try {
      if (JSON.stringify(entry.draft) !== JSON.stringify(entry.remote)) {
        localStorage.setItem(DRAFT_PREFIX + filePath, JSON.stringify(entry.draft));
      } else {
        localStorage.removeItem(DRAFT_PREFIX + filePath);
      }
    } catch {
      // Storage unavailable — continue with in-memory draft only.
    }
  };

  const store = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,

    loadFile(filePath, remote) {
      let draft = null;
      try {
        const raw = localStorage.getItem(DRAFT_PREFIX + filePath);
        if (raw) {
          draft = JSON.parse(raw);
        }
      } catch {
        draft = null;
      }
      files.set(filePath, { remote: deepClone(remote), draft: draft || deepClone(remote) });
      emit();
    },

    has: filePath => files.has(filePath),
    allPaths: () => [...files.keys()],
    getDraft: filePath => files.get(filePath)?.draft,
    getRemote: filePath => files.get(filePath)?.remote,

    update(filePath, mutate) {
      const entry = files.get(filePath);
      if (!entry) {
        return;
      }
      const next = deepClone(entry.draft);
      mutate(next);
      entry.draft = next;
      persist(filePath);
      emit();
    },

    // Dirty checks share the JSON.stringify key-order-sensitive invariant
    // documented on persist() above.
    isDirty(filePath) {
      const entry = files.get(filePath);
      return Boolean(entry) && JSON.stringify(entry.draft) !== JSON.stringify(entry.remote);
    },

    isKeyDirty(filePath, key) {
      const entry = files.get(filePath);
      return Boolean(entry) && JSON.stringify(entry.draft?.[key]) !== JSON.stringify(entry.remote?.[key]);
    },

    dirtyPaths() {
      return [...files.keys()].filter(filePath => store.isDirty(filePath));
    },

    discardFile(filePath) {
      const entry = files.get(filePath);
      if (!entry) {
        return;
      }
      entry.draft = deepClone(entry.remote);
      try {
        localStorage.removeItem(DRAFT_PREFIX + filePath);
      } catch {
        // Storage unavailable — in-memory state is already reset.
      }
      emit();
    },

    discardKeys(filePath, keys) {
      store.update(filePath, draft => {
        const entry = files.get(filePath);
        for (const key of keys) {
          draft[key] = deepClone(entry.remote[key]);
        }
      });
    },

    markPublished(filePaths) {
      for (const filePath of filePaths) {
        const entry = files.get(filePath);
        if (entry) {
          entry.remote = deepClone(entry.draft);
          try {
            localStorage.removeItem(DRAFT_PREFIX + filePath);
          } catch {
            // Storage unavailable — in-memory state is already published.
          }
        }
      }
      emit();
    },
  };

  return store;
}
