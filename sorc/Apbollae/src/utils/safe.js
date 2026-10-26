// src/utils/safe.js
export const replacer = (_k, v) => {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  if (typeof v === "bigint") return String(v);
  return v;
};

export const safeStringify = (v, max = 50000) => {
  try {
    const s = JSON.stringify(v, replacer, 2);
    return s.length > max ? s.slice(0, max) + "…(trunc)" : s;
  } catch (e) {
    return `<non-serializable: ${String(e?.message || e)}>`;
  }
};

export const logChunked = (tag, obj, size = 3000) => {
  try {
    const s = safeStringify(obj);
    for (let i = 0; i < s.length; i += size) {
      console.log(`${tag}[${1 + Math.floor(i / size)}] ${s.slice(i, i + size)}`);
    }
  } catch (e) {
    console.log(`${tag}[logChunked][ERR]`, e?.message || e);
  }
};
