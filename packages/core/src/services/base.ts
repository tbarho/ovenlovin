/* eslint-disable no-undef */
import type { DbClient } from "@ovenlovin/db/client";
import type { PaginatedResponse, Pagination } from "../schemas/common";

export abstract class BaseService {
  // eslint-disable-next-line no-unused-vars
  constructor(protected _db: DbClient) {}

  protected buildPaginatedResponse<T extends { createdAt: string; id: string }>(
    items: T[],
    limit: number
  ): PaginatedResponse<T> {
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && items[limit] ? this.encodeCursor(items[limit]) : null;

    return {
      items: resultItems,
      nextCursor,
      hasMore,
    };
  }

  protected encodeCursor(item: { createdAt: string; id: string }): string {
    const str = JSON.stringify({ createdAt: item.createdAt, id: item.id });
    if (typeof btoa !== "undefined") {
      return btoa(str);
    }
    return Buffer.from(str).toString("base64");
  }

  protected decodeCursor(cursor: string): { createdAt: string; id: string } {
    let str: string;
    if (typeof atob !== "undefined") {
      str = atob(cursor);
    } else {
      str = Buffer.from(cursor, "base64").toString("utf-8");
    }
    return JSON.parse(str);
  }

  protected getPaginationParams(pagination?: Pagination) {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    return { limit, cursor };
  }
}
