import type { AppStore } from "../data/store.js";

export interface AppRepository {
  initialize(seedStore: AppStore): Promise<void>;
  loadStore(): Promise<AppStore>;
  replaceStore(store: AppStore): Promise<void>;
}

function cloneStore(store: AppStore): AppStore {
  return structuredClone(store);
}

export class InMemoryAppRepository implements AppRepository {
  constructor(private store: AppStore) {}

  async initialize(seedStore: AppStore): Promise<void> {
    if (!this.store.users.length) {
      this.store = cloneStore(seedStore);
    }
  }

  async loadStore(): Promise<AppStore> {
    return cloneStore(this.store);
  }

  async replaceStore(store: AppStore): Promise<void> {
    this.store = cloneStore(store);
  }
}
