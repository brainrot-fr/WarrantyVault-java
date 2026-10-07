const memory = new Map();
function area(name) {
  try { return window[name]; } catch { return null; }
}
function makeStore(name) {
  return {
    get(key) { try { return area(name)?.getItem(key) ?? memory.get(`${name}:${key}`) ?? null; } catch { return memory.get(`${name}:${key}`) ?? null; } },
    set(key, value) { try { area(name)?.setItem(key, value); } catch { memory.set(`${name}:${key}`, value); } },
    remove(key) { try { area(name)?.removeItem(key); } catch { memory.delete(`${name}:${key}`); } }
  };
}
export const storage = makeStore('localStorage');
export const sessionStorageSafe = makeStore('sessionStorage');
