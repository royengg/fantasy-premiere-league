import type { AppStore } from "../data/store.js";

export interface AppRepository {
  initialize(seedStore: AppStore): Promise<void>;
  loadStore(): Promise<AppStore>;
  replaceStore(store: AppStore): Promise<void>;
  updateProviderState(patch: Partial<AppStore["provider"]>): Promise<void>;
}
