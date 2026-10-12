/**
 * Streamable HTTP transport for MCP server
 *
 * Implements Server-Sent Events (SSE) transport as specified in the MCP spec
 * for remote MCP servers over HTTP.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export interface HttpTransportOptions {
  /**
   * Authentication header to validate (e.g., "Bearer <token>")
   */
  authHeader?: string;
  /**
   * Callback to extract auth context from request
   */
  onAuth?: (authHeader: string) => Promise<AuthInfo> | AuthInfo;
}

export interface AuthInfo {
  householdId: string;
  userId: string;
  scopes: string[];
}

/**
 * Create a readable stream for SSE responses
 */
class SSETransport implements Transport {
  private messageQueue: JSONRPCMessage[] = [];
  private readyResolve?: () => void;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  async start(): Promise<void> {
    this.readyResolve?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.messageQueue.push(message);
  }

  async close(): Promise<void> {
    // Cleanup
  }

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  getMessages(): JSONRPCMessage[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }

  receiveMessage(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }
}

/**
 * Handle MCP over HTTP with SSE
 */
export async function handleHttpRequest(
  server: Server,
  request: {
    method: string;
    body: JSONRPCMessage;
    headers: Record<string, string>;
  },
  options: HttpTransportOptions = {}
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: AsyncIterable<string> | string;
}> {
  // Validate method
  if (request.method !== "POST") {
    return {
      status: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Validate auth if required
  if (options.onAuth) {
    const authHeader = request.headers.authorization || request.headers.Authorization;
    if (!authHeader) {
      return {
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    try {
      await options.onAuth(authHeader);
    } catch (error) {
      return {
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Unauthorized",
          message: error instanceof Error ? error.message : "Invalid credentials",
        }),
      };
    }
  }

  // Create transport
  const transport = new SSETransport();

  // Connect server to transport
  await server.connect(transport);

  // Process request
  transport.receiveMessage(request.body);

  // Wait a bit for response (simple implementation)
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get response messages
  const messages = transport.getMessages();

  // Close transport
  await transport.close();

  // Return response
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  };
}
