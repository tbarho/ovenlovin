/**
 * Streamable HTTP client transport for MCP SDK
 *
 * Implements the Transport interface for HTTP-based MCP communication
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export interface HTTPClientOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export class StreamableHTTPClientTransport implements Transport {
  private url: string;
  private options: HTTPClientOptions;
  private onmessageCallback?: (message: JSONRPCMessage) => void;
  private oncloseCallback?: () => void;
  private onerrorCallback?: (error: Error) => void;
  private abortController?: AbortController;

  constructor(url: string, options: HTTPClientOptions = {}) {
    this.url = url;
    this.options = options;
  }

  async start(): Promise<void> {
    // No persistent connection needed for HTTP
    return Promise.resolve();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.options.headers,
        },
        body: JSON.stringify(message),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      if (this.onmessageCallback) {
        this.onmessageCallback(responseData);
      }
    } catch (error) {
      if (this.onerrorCallback) {
        this.onerrorCallback(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.oncloseCallback) {
      this.oncloseCallback();
    }

    return Promise.resolve();
  }

  set onmessage(callback: (message: JSONRPCMessage) => void) {
    this.onmessageCallback = callback;
  }

  set onclose(callback: () => void) {
    this.oncloseCallback = callback;
  }

  set onerror(callback: (error: Error) => void) {
    this.onerrorCallback = callback;
  }
}
