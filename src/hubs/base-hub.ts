import {
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import type { HubConnection, IRetryPolicy, RetryContext } from '@microsoft/signalr';
import pRetry from 'p-retry';
import type { HubOptions } from './types.js';
import type { AuthManager } from '../auth/auth-manager.js';

/** Exponential backoff retry policy for SignalR automatic reconnect. */
const retryPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds(ctx: RetryContext): number | null {
    if (ctx.previousRetryCount === 0) return 0;
    return Math.min(1000 * Math.pow(2, ctx.previousRetryCount - 1), 30_000);
  },
};

/**
 * Abstract base class for SignalR hub connections.
 *
 * Handles all connection lifecycle concerns:
 * - HubConnectionBuilder setup with WebSocket transport and skipNegotiation
 * - Exponential backoff reconnect via IRetryPolicy
 * - Subscription tracking and replay on reconnect (onreconnected)
 * - Initial start retry with p-retry
 * - onclose fallback for reconnect exhaustion
 * - Proactive token-refresh-triggered reconnection
 */
export abstract class BaseHub {
  protected connection: HubConnection;
  protected activeSubscriptions = new Map<string, () => Promise<void>>();
  private authManager: AuthManager;
  private lastUsedToken: string | null = null;
  private tokenCheckTimer?: ReturnType<typeof setInterval>;
  private stopped = false;

  constructor(options: HubOptions) {
    this.authManager = options.authManager;

    this.connection = new HubConnectionBuilder()
      .withUrl(options.url, {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
        accessTokenFactory: () => this.authManager.getToken(),
      })
      .withAutomaticReconnect(retryPolicy)
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.onreconnected(() => this.resubscribeAll());
    this.connection.onclose(() => this.handleClose());
  }

  /** Start the hub connection with retry logic for initial connection failures. */
  async start(): Promise<void> {
    this.stopped = false;
    await pRetry(
      async () => {
        if (this.connection.state === HubConnectionState.Disconnected) {
          await this.connection.start();
        }
      },
      { retries: 10, minTimeout: 1_000, maxTimeout: 30_000, factor: 2, randomize: true },
    );
    this.lastUsedToken = await this.authManager.getToken();
    this.startTokenCheck();
  }

  /** Stop the hub connection and clean up all subscriptions and timers. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.stopTokenCheck();
    this.activeSubscriptions.clear();
    await this.connection.stop();
  }

  /** Current connection state. */
  get state(): HubConnectionState {
    return this.connection.state;
  }

  /**
   * Subscribe to a server method and track the subscription for replay on reconnect.
   * @param method - The server method name to invoke (e.g., "SubscribeAccounts").
   * @param args - Arguments to pass to the server method.
   */
  protected async subscribe(method: string, ...args: unknown[]): Promise<void> {
    const key = args.length > 0 ? `${method}:${args.join(',')}` : method;
    await this.connection.invoke(method, ...args);
    this.activeSubscriptions.set(key, () => this.connection.invoke(method, ...args));
  }

  /**
   * Unsubscribe from a server method and remove it from subscription tracking.
   * @param method - The server unsubscribe method name (e.g., "UnsubscribeAccounts").
   * @param args - Arguments to pass to the server method.
   */
  protected async unsubscribe(method: string, ...args: unknown[]): Promise<void> {
    const key =
      args.length > 0
        ? `${method.replace('Unsubscribe', 'Subscribe')}:${args.join(',')}`
        : method.replace('Unsubscribe', 'Subscribe');
    await this.connection.invoke(method, ...args);
    this.activeSubscriptions.delete(key);
  }

  /**
   * Register a typed event handler on the connection.
   * @param event - The event name to listen for.
   * @param handler - The callback to invoke when the event fires.
   * @returns A function that removes the handler when called.
   */
  protected on<T>(event: string, handler: (data: T) => void): () => void {
    this.connection.on(event, handler);
    return () => this.connection.off(event, handler);
  }

  /** Replay all tracked subscriptions. Called after reconnect or token refresh. */
  private async resubscribeAll(): Promise<void> {
    const resubs = [...this.activeSubscriptions.values()];
    await Promise.all(resubs.map((fn) => fn()));
  }

  /**
   * Handle connection close (automatic reconnect exhausted).
   * Re-attempts start with retry unless intentionally stopped.
   */
  private async handleClose(): Promise<void> {
    if (this.stopped) return;
    try {
      await pRetry(
        async () => {
          if (this.connection.state === HubConnectionState.Disconnected) {
            await this.connection.start();
          }
        },
        { retries: 10, minTimeout: 1_000, maxTimeout: 30_000, factor: 2, randomize: true },
      );
      this.lastUsedToken = await this.authManager.getToken();
      await this.resubscribeAll();
    } catch {
      // Connection permanently failed -- caller should handle via state check
    }
  }

  /** Start periodic token check to proactively reconnect on token refresh. */
  private startTokenCheck(): void {
    this.stopTokenCheck();
    this.tokenCheckTimer = setInterval(async () => {
      if (this.connection.state !== HubConnectionState.Connected) return;
      try {
        const currentToken = await this.authManager.getToken();
        if (currentToken !== this.lastUsedToken) {
          this.lastUsedToken = currentToken;
          await this.connection.stop();
          await this.connection.start();
          // onreconnected does NOT fire after manual stop/start
          await this.resubscribeAll();
        }
      } catch {
        // Token check failure is non-fatal; next interval will retry
      }
    }, 60_000);
  }

  /** Stop the periodic token check timer. */
  private stopTokenCheck(): void {
    if (this.tokenCheckTimer) {
      clearInterval(this.tokenCheckTimer);
      this.tokenCheckTimer = undefined;
    }
  }
}
