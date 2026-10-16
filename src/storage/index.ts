import { ProfileStore } from './profileStore';
import { IndexedDbProfileStore } from './indexedDbProfileStore';
import { TauriProfileStore } from './tauriProfileStore';

let storeInstance: ProfileStore | null = null;

export function createProfileStore(): ProfileStore {
  if (__DESKTOP__) {
    return new TauriProfileStore();
  }
  return new IndexedDbProfileStore();
}

export function getProfileStore(): ProfileStore {
  if (!storeInstance) {
    storeInstance = createProfileStore();
  }
  return storeInstance;
}

export function setProfileStore(customStore: ProfileStore | null): void {
  storeInstance = customStore;
}

export * from './profileStore';
export * from './memoryProfileStore';
export * from './indexedDbProfileStore';
export * from './tauriProfileStore';
export * from './keyValidation';
export * from './snapshots';

