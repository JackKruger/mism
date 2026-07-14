/**
 * Insertion-ordered entity store. Iteration order is deterministic (insertion
 * order), which the determinism rule depends on — never iterate a bare Map/Set
 * whose order could differ between runs.
 */
export class Store<Id extends number, T> {
  readonly ids: Id[] = [];
  private byId = new Map<Id, T>();

  add(id: Id, value: T): void {
    if (this.byId.has(id)) throw new Error(`Store: duplicate id ${id}`);
    this.ids.push(id);
    this.byId.set(id, value);
  }

  get(id: Id): T | undefined {
    return this.byId.get(id);
  }

  getOrThrow(id: Id): T {
    const v = this.byId.get(id);
    if (v === undefined) throw new Error(`Store: missing id ${id}`);
    return v;
  }

  remove(id: Id): void {
    if (!this.byId.delete(id)) return;
    const i = this.ids.indexOf(id);
    if (i >= 0) this.ids.splice(i, 1);
  }

  get size(): number {
    return this.ids.length;
  }

  *values(): IterableIterator<T> {
    for (const id of this.ids) yield this.byId.get(id) as T;
  }
}
