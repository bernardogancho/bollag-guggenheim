import { createContext, useContext, useSyncExternalStore } from 'react';

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

// Re-render subscriber for the drafts store.
export function useStoreVersion(store) {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
