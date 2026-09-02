/**
 * In-memory key-value store with TTL support.
 * Replaces Redis — no external dependency needed for the test portal.
 */

const store = new Map<string, { value: string; expiresAt: number }>();

/** Periodic cleanup of expired entries (every 10 seconds) */
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now >= entry.expiresAt) {
            store.delete(key);
        }
    }
}, 10_000);

const memoryStore = {
    async set(key: string, value: string, _flag: string, ttlSeconds: number): Promise<void> {
        store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    },

    async get(key: string): Promise<string | null> {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.value;
    },

    /** One-time consume: returns the value and deletes it (null if absent/expired). */
    async getdel(key: string): Promise<string | null> {
        const entry = store.get(key);
        store.delete(key);
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) return null;
        return entry.value;
    },
};

export default memoryStore;
