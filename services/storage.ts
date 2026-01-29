
export const storage = {
  save: (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data)),
  get: (key: string) => {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : null;
  },
  remove: (key: string) => localStorage.removeItem(key)
};
