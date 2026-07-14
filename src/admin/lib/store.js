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

  const persist = filePath => {
    const entry = files.get(filePath);
    if (JSON.stringify(entry.draft) !== JSON.stringify(entry.remote)) {
      localStorage.setItem(DRAFT_PREFIX + filePath, JSON.stringify(entry.draft));
    } else {
      localStorage.removeItem(DRAFT_PREFIX + filePath);
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
      const raw = localStorage.getItem(DRAFT_PREFIX + filePath);
      if (raw) {
        try {
          draft = JSON.parse(raw);
        } catch {
          draft = null;
        }
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
      localStorage.removeItem(DRAFT_PREFIX + filePath);
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
          localStorage.removeItem(DRAFT_PREFIX + filePath);
        }
      }
      emit();
    },
  };

  return store;
}
