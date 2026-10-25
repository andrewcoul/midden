import type { Db } from "../types";

const clean = (params: unknown[]) => params.map((p) => (p === undefined ? null : p));

export function d1Db(d1: D1Database): Db {
  return {
    async all<T>(sql: string, ...params: unknown[]) {
      return (await d1.prepare(sql).bind(...clean(params)).all<T>()).results;
    },
    async first<T>(sql: string, ...params: unknown[]) {
      return d1.prepare(sql).bind(...clean(params)).first<T>();
    },
    async run(sql: string, ...params: unknown[]) {
      const res = await d1.prepare(sql).bind(...clean(params)).run();
      return { changes: res.meta.changes };
    },
  };
}
