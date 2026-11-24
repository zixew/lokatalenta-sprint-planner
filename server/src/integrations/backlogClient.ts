import { normalizeBacklogBaseUrl } from '../config.js';
import type { DivisionId } from '../contracts/canonical.js';

export interface BacklogItem {
  readonly id: string;
  readonly type?: string;
  readonly title: string;
  readonly description?: string;
  readonly storyPoints?: number;
  readonly priority?: string;
  readonly moscow?: string;
  readonly status?: string;
  readonly ownerDivision?: DivisionId | string;
  readonly ownerAgentId?: number | null;
  readonly sprintId?: string | null;
}

export interface BacklogSyncResult {
  readonly synced: boolean;
  readonly statusCode?: number;
  readonly warning?: string;
}

export interface BacklogClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class BacklogClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: BacklogClientOptions) {
    this.baseUrl = normalizeBacklogBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  async fetchItems(filters?: {
    status?: string;
    division?: string;
    sprintId?: string;
    priority?: string;
    type?: string;
    q?: string;
  }): Promise<{ items: BacklogItem[]; backlogSync: BacklogSyncResult }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.division) params.set('division', filters.division);
    if (filters?.sprintId) params.set('sprintId', filters.sprintId);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.q) params.set('q', filters.q);

    const qs = params.toString();
    const url = `${this.baseUrl}/api/items${qs ? `?${qs}` : ''}`;

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return {
          items: [],
          backlogSync: {
            synced: false,
            statusCode: response.status,
            warning: `Backlog API returned HTTP ${response.status} from ${url}`,
          },
        };
      }

      const data = (await response.json()) as { items?: unknown };
      const items = Array.isArray(data?.items) ? (data.items as BacklogItem[]) : [];
      return {
        items,
        backlogSync: {
          synced: true,
          statusCode: response.status,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        items: [],
        backlogSync: {
          synced: false,
          warning: `Backlog API unavailable at ${this.baseUrl}: ${message}`,
        },
      };
    }
  }

  async patchItem(
    itemId: string,
    patch: { sprintId?: string | null; status?: string },
  ): Promise<{ item?: BacklogItem; backlogSync: BacklogSyncResult }> {
    const url = `${this.baseUrl}/api/items/${encodeURIComponent(itemId)}`;

    try {
      const response = await this.fetchImpl(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return {
          backlogSync: {
            synced: false,
            statusCode: response.status,
            warning: `Backlog item sync returned HTTP ${response.status} for ${itemId}`,
          },
        };
      }

      let item: BacklogItem | undefined;
      try {
        const data = (await response.json()) as { item?: BacklogItem };
        if (data && typeof data === 'object' && data.item) {
          item = data.item;
        }
      } catch {
        // tolerate empty/non-JSON 204/200 responses
      }

      return {
        item,
        backlogSync: {
          synced: true,
          statusCode: response.status,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        backlogSync: {
          synced: false,
          warning: `Backlog API unavailable during item sync for ${itemId}: ${message}`,
        },
      };
    }
  }
}
