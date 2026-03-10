# topstepx

TypeScript SDK for the TopstepX trading API -- REST, WebSocket, and React hooks.

## Install

```bash
npm install topstepx
```

## Quick Start

### Node.js / Bots

```typescript
import { createClient } from 'topstepx';

// Create client with username and API key (Supabase-style)
const client = createClient('your-username', 'your-api-key');

// Get accounts
const accounts = await client.accounts.search({});

// Place a market order
const order = await client.orders.place({
  accountId: accounts[0].id,
  contractId: 'CON.F.US.EP.U25', // E-mini S&P 500
  type: 2, // Market
  side: 0, // Buy
  size: 1,
});
```

Or use the class-based approach:

```typescript
import { TopstepXClient } from 'topstepx';

const client = new TopstepXClient({
  credentials: { userName: 'your-username', apiKey: 'your-api-key' },
});
```

### React

```tsx
import { TopstepXProvider, useAccounts, usePositions } from 'topstepx/react';

function App() {
  return (
    <TopstepXProvider userName="your-username" apiKey="your-api-key">
      <Dashboard />
    </TopstepXProvider>
  );
}

function Dashboard() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: positions } = usePositions(accounts?.[0]?.id);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Positions for {accounts?.[0]?.name}</h1>
      <ul>
        {positions?.map(p => (
          <li key={p.contractId}>
            {p.contractId}: {p.size} contracts
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Features

- **Full TypeScript support** - Complete type definitions for all API entities, enums, and responses
- **REST Client** - Type-safe wrappers for all endpoints: accounts, contracts, orders, positions, trades, history bars
- **Real-time WebSocket** - SignalR-based live data: orders, positions, trades, quotes, market depth
- **React Hooks** - Built-in hooks with loading/error states and automatic real-time data synchronization
- **Fluent Order Builder** - Chainable API for building complex orders with validation
- **Advanced Order Types** - OCO (One-Cancels-Other), multi-target brackets, trailing stops, ATM strategies
- **Trade Copier** - Mirror trades from one account to multiple target accounts
- **Automatic Token Refresh** - Handles authentication and token renewal automatically
- **Rate Limiting** - Built-in request queuing and retry logic
- **ESM-only** - Tree-shakeable, zero unnecessary dependencies

## Table of Contents

- [Connection URLs](#connection-urls)
- [Rate Limits](#rate-limits)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [REST API](#rest-api)
  - [Accounts](#accounts)
  - [Contracts](#contracts)
  - [Orders](#orders)
  - [Positions](#positions)
  - [Trades](#trades)
  - [History](#history)
- [Real-time WebSocket](#real-time-websocket)
  - [User Hub](#user-hub)
  - [Market Hub](#market-hub)
- [Order Builder](#order-builder)
- [Advanced Features](#advanced-features)
  - [OCO Orders](#oco-orders)
  - [Bracket Orders](#bracket-orders)
  - [ATM Strategies](#atm-strategies)
  - [Trade Copier](#trade-copier)
- [React Hooks](#react-hooks)
- [Error Handling](#error-handling)
- [TypeScript](#typescript)
- [Enums](#enums)

## Connection URLs

| Service | URL |
|---------|-----|
| **REST API** | `https://api.topstepx.com` |
| **User Hub** | `wss://rtc.topstepx.com/hubs/user` |
| **Market Hub** | `wss://rtc.topstepx.com/hubs/market` |

## Rate Limits

The Gateway API employs rate limiting to ensure stability and reliability:

| Endpoint | Limit |
|----------|-------|
| `POST /api/History/retrieveBars` | 50 requests / 30 seconds |
| All other endpoints | 200 requests / 60 seconds |

If you exceed the rate limit, the API returns an HTTP 429 (Too Many Requests) error. The SDK includes built-in retry logic.

## Authentication

The SDK supports two authentication methods via JSON Web Tokens (JWT).

### API Key Authentication (Recommended)

The SDK handles token acquisition automatically. Tokens are valid for 24 hours and are automatically refreshed.

```typescript
const client = createClient('username', 'apiKey');
```

**API Endpoint:** `POST https://api.topstepx.com/api/Auth/loginKey`

**Request:**
```json
{
  "userName": "your-username",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "token": "your_session_token_here",
  "success": true,
  "errorCode": 0,
  "errorMessage": null
}
```

### Application Credentials (Legacy)

For authorized applications with admin credentials:

```typescript
const client = new TopstepXClient({
  credentials: {
    userName: 'username',
    password: 'password',
    deviceId: 'device-id',
    appId: 'app-id',
    verifyKey: 'verify-key',
  },
});
```

**API Endpoint:** `POST https://api.topstepx.com/api/Auth/loginApp`

### Token Validation

The SDK automatically validates and refreshes tokens. To manually validate:

**API Endpoint:** `POST https://api.topstepx.com/api/Auth/validate`

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": null,
  "newToken": "NEW_TOKEN"
}
```

### Custom Token Store

Implement the `TokenStore` interface for custom token persistence (Redis, database, etc.):

```typescript
import { createClient, type TokenStore } from 'topstepx';

const redisTokenStore: TokenStore = {
  async get() {
    return await redis.get('topstepx:token');
  },
  async set(token) {
    await redis.set('topstepx:token', token, 'EX', 3600);
  },
  async clear() {
    await redis.del('topstepx:token');
  },
};

const client = createClient('username', 'apiKey', {
  tokenStore: redisTokenStore,
});
```

## Configuration

### Client Options

```typescript
import { createClient } from 'topstepx';

const client = createClient('username', 'apiKey', {
  baseUrl: 'https://api.topstepx.com',    // Optional: custom REST API URL
  rtcUrl: 'https://rtc.topstepx.com',       // Optional: custom WebSocket URL
  tokenStore: customTokenStore,            // Optional: custom token persistence
});
```

### Environment Variables

```bash
# .env
TOPSTEPX_USERNAME=your-username
TOPSTEPX_API_KEY=your-api-key
```

```typescript
import { createClient } from 'topstepx';

const client = createClient(
  process.env.TOPSTEPX_USERNAME!,
  process.env.TOPSTEPX_API_KEY!
);
```

## REST API

All REST API methods are available through the client object.

### Accounts

Search for accounts associated with your user.

**API Endpoint:** `POST https://api.topstepx.com/api/Account/search`

```typescript
// List all accounts
const { accounts } = await client.accounts.search({});

// Get only active trading accounts
const { accounts } = await client.accounts.search({ onlyActiveAccounts: true });

// Get only active accounts (canTrade = true)
const activeAccounts = await client.getActiveAccounts();

// Get account summary (account + positions + orders)
const summary = await client.getAccountSummary(accountId);
```

**Response:**
```json
{
  "accounts": [
    {
      "id": 1,
      "name": "TEST_ACCOUNT_1",
      "balance": 50000,
      "canTrade": true,
      "isVisible": true
    }
  ],
  "success": true,
  "errorCode": 0,
  "errorMessage": null
}
```

### Contracts

**Contract ID Format:** `CON.F.US.{SYMBOL}.{MONTH}{YEAR}`

Examples:
- `CON.F.US.EP.U25` - E-mini S&P 500, September 2025
- `CON.F.US.ENQ.U25` - E-mini NASDAQ-100, September 2025
- `CON.F.US.BP6.U25` - British Pound, September 2025

**API Endpoints:**
- Search: `POST https://api.topstepx.com/api/Contract/search`
- By ID: `POST https://api.topstepx.com/api/Contract/searchById`
- Available: `POST https://api.topstepx.com/api/Contract/available`

```typescript
// Search contracts (returns up to 20 contracts)
const { contracts } = await client.contracts.search({
  searchText: 'NQ',
  live: false,
});

// Get contract by ID
const { contract } = await client.contracts.searchById({ 
  contractId: 'CON.F.US.ENQ.H25' 
});

// Get active contracts (with caching)
const activeContracts = await client.getActiveContracts();

// Find contract by symbol (uses cache)
const contract = await client.findContract('ESM4');
```

**Contract Response:**
```json
{
  "id": "CON.F.US.ENQ.U25",
  "name": "NQU5",
  "description": "E-mini NASDAQ-100: September 2025",
  "tickSize": 0.25,
  "tickValue": 5,
  "activeContract": true,
  "symbolId": "F.US.ENQ"
}
```

### Orders

**API Endpoints:**
- Place: `POST https://api.topstepx.com/api/Order/place`
- Search: `POST https://api.topstepx.com/api/Order/search`
- Search Open: `POST https://api.topstepx.com/api/Order/searchOpen`
- Cancel: `POST https://api.topstepx.com/api/Order/cancel`
- Modify: `POST https://api.topstepx.com/api/Order/modify`

```typescript
import { OrderType, OrderSide } from 'topstepx';

// Place a market order
const { orderId } = await client.orders.place({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  type: OrderType.Market, // 2
  side: OrderSide.Bid,      // 0 = Buy
  size: 1,
});

// Place a limit order
const { orderId } = await client.orders.place({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  type: OrderType.Limit,   // 1
  side: OrderSide.Bid,     // 0 = Buy
  size: 1,
  limitPrice: 5000.00,
});

// Place a stop order
const { orderId } = await client.orders.place({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  type: OrderType.Stop,    // 4
  side: OrderSide.Ask,     // 1 = Sell
  size: 1,
  stopPrice: 4900.00,
});

// Place order with brackets (stop loss + take profit)
const { orderId } = await client.orders.place({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  type: OrderType.Market,
  side: OrderSide.Bid,
  size: 1,
  stopLossBracket: {
    ticks: 20,
    type: OrderType.Stop,
  },
  takeProfitBracket: {
    ticks: 40,
    type: OrderType.Limit,
  },
});

// Search orders by time range
const { orders } = await client.orders.search({
  accountId: 123,
  startTimestamp: '2025-07-18T21:00:00Z',
  endTimestamp: '2025-07-18T22:00:00Z',
});

// Get open orders
const { orders } = await client.orders.searchOpen({ accountId: 123 });

// Cancel an order
await client.orders.cancel({ accountId: 123, orderId: 789 });

// Cancel all orders
await client.cancelAllOrders(123);

// Modify an order
await client.orders.modify({
  accountId: 123,
  orderId: 789,
  size: 2,
  limitPrice: 5100.00,
});
```

**Order Response:**
```json
{
  "id": 36598,
  "accountId": 704,
  "contractId": "CON.F.US.EP.U25",
  "symbolId": "F.US.EP",
  "creationTimestamp": "2025-07-18T21:00:01.268009+00:00",
  "updateTimestamp": "2025-07-18T21:00:01.268009+00:00",
  "status": 2,
  "type": 2,
  "side": 0,
  "size": 1,
  "limitPrice": null,
  "stopPrice": null,
  "fillVolume": 1,
  "filledPrice": 6335.25,
  "customTag": null
}
```

### Positions

**API Endpoints:**
- Search Open: `POST https://api.topstepx.com/api/Position/searchOpen`
- Close: `POST https://api.topstepx.com/api/Position/closeContract`
- Partial Close: `POST https://api.topstepx.com/api/Position/partialCloseContract`

```typescript
// Get open positions
const { positions } = await client.positions.searchOpen({ accountId: 123 });

// Close a position
await client.positions.closeContract({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
});

// Partial close
await client.positions.partialCloseContract({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  size: 1,
});

// Flatten all positions
await client.flattenAll(123);
```

**Position Response:**
```json
{
  "positions": [
    {
      "id": 6124,
      "accountId": 536,
      "contractId": "CON.F.US.GMET.J25",
      "creationTimestamp": "2025-04-21T19:52:32.175721+00:00",
      "type": 1,
      "size": 2,
      "averagePrice": 1575.75
    }
  ],
  "success": true,
  "errorCode": 0,
  "errorMessage": null
}
```

### Trades

**API Endpoint:** `POST https://api.topstepx.com/api/Trade/search`

```typescript
// Search trades
const { trades } = await client.trades.search({
  accountId: 123,
  startTimestamp: '2025-01-20T15:47:39.882Z',
  endTimestamp: '2025-01-30T15:47:39.882Z',
});
```

**Trade Response:**
```json
{
  "trades": [
    {
      "id": 8604,
      "accountId": 203,
      "contractId": "CON.F.US.EP.H25",
      "creationTimestamp": "2025-01-21T16:13:52.523293+00:00",
      "price": 6065.25,
      "profitAndLoss": 50.00,
      "fees": 1.40,
      "side": 1,
      "size": 1,
      "voided": false,
      "orderId": 14328
    }
  ],
  "success": true,
  "errorCode": 0,
  "errorMessage": null
}
```

Note: A `null` value for `profitAndLoss` indicates a half-turn trade.

### History

**API Endpoint:** `POST https://api.topstepx.com/api/History/retrieveBars`

**Limits:** Maximum 20,000 bars per request

```typescript
import { BarUnit } from 'topstepx';

// Get historical bars
const { bars } = await client.history.retrieveBars({
  contractId: 'CON.F.US.RTY.Z24',
  live: false,
  startTime: '2024-12-01T00:00:00Z',
  endTime: '2024-12-31T21:00:00Z',
  unit: BarUnit.Hour,    // 3
  unitNumber: 1,
  limit: 1000,
  includePartialBar: false,
});

// Convenient helper with defaults
const bars = await client.getBars('CON.F.US.EP.U25', {
  unit: BarUnit.Minute,
  unitNumber: 5,
  limit: 500,
});
```

**Bar Response:**
```json
{
  "bars": [
    {
      "t": "2024-12-20T14:00:00+00:00",
      "o": 2208.10,
      "h": 2217.00,
      "l": 2206.70,
      "c": 2210.10,
      "v": 87
    }
  ],
  "success": true,
  "errorCode": 0,
  "errorMessage": null
}
```

**Bar Fields:**
- `t` - Timestamp
- `o` - Open price
- `h` - High price
- `l` - Low price
- `c` - Close price
- `v` - Volume

## Real-time WebSocket

Connect to real-time data streams via SignalR hubs. The SDK uses WebSockets with automatic reconnection.

### Connection Management

```typescript
// Connect all hubs
await client.connect();

// Check connection state
import { HubConnectionState } from '@microsoft/signalr';
const isConnected = client.userHub.state === HubConnectionState.Connected;

// Disconnect
await client.disconnect();
```

### User Hub

Real-time account, order, position, and trade events.

**WebSocket URL:** `wss://rtc.topstepx.com/hubs/user`

```typescript
// Subscribe to order updates
const unsubOrders = client.userHub.onOrder((order) => {
  console.log('Order update:', order);
});

// Subscribe to position updates
const unsubPositions = client.userHub.onPosition((position) => {
  console.log('Position update:', position);
});

// Subscribe to trade events
const unsubTrades = client.userHub.onTrade((trade) => {
  console.log('New trade:', trade);
});

// Subscribe to account updates
const unsubAccounts = client.userHub.onAccount((account) => {
  console.log('Account update:', account);
});

// Start receiving updates for an account
await client.userHub.subscribeOrders(accountId);
await client.userHub.subscribePositions(accountId);
await client.userHub.subscribeTrades(accountId);
await client.userHub.subscribeAccounts();

// Cleanup
unsubOrders();
unsubPositions();
unsubTrades();
unsubAccounts();
```

#### GatewayUserOrder Event

```json
{
  "id": 789,
  "accountId": 123,
  "contractId": "CON.F.US.EP.U25",
  "symbolId": "F.US.EP",
  "creationTimestamp": "2024-07-21T13:45:00Z",
  "updateTimestamp": "2024-07-21T13:46:00Z",
  "status": 1,
  "type": 1,
  "side": 0,
  "size": 1,
  "limitPrice": 2100.50,
  "stopPrice": null,
  "fillVolume": 0,
  "filledPrice": null,
  "customTag": "strategy-1"
}
```

**Fields:**
- `id` - Order ID
- `accountId` - Account ID
- `contractId` - Contract ID
- `symbolId` - Symbol ID
- `creationTimestamp` - When order was created
- `updateTimestamp` - When order was last updated
- `status` - Order status (see OrderStatus enum)
- `type` - Order type (see OrderType enum)
- `side` - Order side (0=Bid, 1=Ask)
- `size` - Order size
- `limitPrice` - Limit price (if applicable)
- `stopPrice` - Stop price (if applicable)
- `fillVolume` - Number of contracts filled
- `filledPrice` - Price at which order was filled
- `customTag` - Custom tag for the order

#### GatewayUserPosition Event

```json
{
  "id": 456,
  "accountId": 123,
  "contractId": "CON.F.US.EP.U25",
  "creationTimestamp": "2024-07-21T13:45:00Z",
  "type": 1,
  "size": 2,
  "averagePrice": 2100.25
}
```

**Fields:**
- `id` - Position ID
- `accountId` - Account ID
- `contractId` - Contract ID
- `creationTimestamp` - When position was opened
- `type` - Position type (1=Long, 2=Short)
- `size` - Position size
- `averagePrice` - Average entry price

#### GatewayUserTrade Event

```json
{
  "id": 101112,
  "accountId": 123,
  "contractId": "CON.F.US.EP.U25",
  "creationTimestamp": "2024-07-21T13:47:00Z",
  "price": 2100.75,
  "profitAndLoss": 50.25,
  "fees": 2.50,
  "side": 0,
  "size": 1,
  "voided": false,
  "orderId": 789
}
```

#### GatewayUserAccount Event

```json
{
  "id": 123,
  "name": "Main Trading Account",
  "balance": 10000.50,
  "canTrade": true,
  "isVisible": true,
  "simulated": false
}
```

### Market Hub

Real-time market data: quotes and depth.

**WebSocket URL:** `wss://rtc.topstepx.com/hubs/market`

```typescript
// Subscribe to quotes
const unsubQuotes = client.marketHub.onQuote((contractId, quote) => {
  console.log('Quote:', contractId, quote.lastPrice);
});

// Subscribe to market depth
const unsubDepth = client.marketHub.onDepth((contractId, depth) => {
  console.log('Depth:', contractId, depth);
});

// Subscribe to market trades
const unsubTrades = client.marketHub.onTrade((contractId, trade) => {
  console.log('Trade:', contractId, trade);
});

// Start receiving data for a contract
await client.marketHub.subscribeQuotes(contractId);
await client.marketHub.subscribeDepth(contractId);
await client.marketHub.subscribeTrades(contractId);
```

#### GatewayQuote Event

```json
{
  "symbol": "F.US.EP",
  "symbolName": "/ES",
  "lastPrice": 2100.25,
  "bestBid": 2100.00,
  "bestAsk": 2100.50,
  "change": 25.50,
  "changePercent": 0.14,
  "open": 2090.00,
  "high": 2110.00,
  "low": 2080.00,
  "volume": 12000,
  "lastUpdated": "2024-07-21T13:45:00Z",
  "timestamp": "2024-07-21T13:45:00Z"
}
```

**Fields:**
- `symbol` - Symbol ID
- `symbolName` - Friendly symbol name
- `lastPrice` - Last traded price
- `bestBid` - Current best bid
- `bestAsk` - Current best ask
- `change` - Price change since previous close
- `changePercent` - Percent change
- `open` - Opening price
- `high` - Session high
- `low` - Session low
- `volume` - Total traded volume
- `lastUpdated` - Last update time
- `timestamp` - Quote timestamp

#### GatewayDepth Event

```json
{
  "timestamp": "2024-07-21T13:45:00Z",
  "type": 1,
  "price": 2100.00,
  "volume": 10,
  "currentVolume": 5
}
```

**Fields:**
- `timestamp` - DOM update timestamp
- `type` - DOM type (see DomType enum)
- `price` - Price level
- `volume` - Total volume at this level
- `currentVolume` - Current volume at this level

#### GatewayTrade Event

```json
{
  "symbolId": "F.US.EP",
  "price": 2100.25,
  "timestamp": "2024-07-21T13:45:00Z",
  "type": 0,
  "volume": 2
}
```

### Convenient Subscriptions

```typescript
// Subscribe to ticker with cleanup
const unsubscribe = await client.subscribeTicker(contractId, (quote) => {
  console.log('Quote:', quote);
});

// Later...
await unsubscribe();

// Get latest quote (one-shot)
const quote = await client.getLatestQuote(contractId, 5000); // 5 second timeout
```

### Event Monitoring

```typescript
// Watch for fills
const unsubFill = client.onFill(accountId, (order) => {
  console.log('Order filled:', order);
});

// Wait for a specific order to fill
try {
  const filledOrder = await client.waitForFill(orderId, 30000); // 30 second timeout
  console.log('Order filled:', filledOrder);
} catch (error) {
  console.log('Timeout waiting for fill');
}

// Watch a specific position
const unsubPosition = client.watchPosition(accountId, contractId, (position) => {
  console.log('Position update:', position);
});

// Watch all orders for an account
const unsubOrders = client.watchOrders(accountId, (order) => {
  console.log('Order update:', order);
});
```

## Order Builder

Build orders fluently with validation.

```typescript
// Simple market order
const orderId = await client
  .order(accountId)
  .market()
  .buy(1)
  .onContract(contractId)
  .place();

// Limit order
const orderId = await client
  .order(accountId)
  .limit(5000.00)
  .sell(2)
  .onContract(contractId)
  .withTag('my-strategy')
  .place();

// Stop order
const orderId = await client
  .order(accountId)
  .stop(4900.00)
  .buy(1)
  .onContract(contractId)
  .place();

// Trailing stop
const orderId = await client
  .order(accountId)
  .trailingStop(10) // 10 ticks
  .sell(1)
  .onContract(contractId)
  .place();

// Modify trailing distance
await client.modifyTrailingDistance(accountId, orderId, 15); // 15 ticks
```

## Advanced Features

### OCO Orders

One-Cancels-Other: Two orders where filling one automatically cancels the other.

```typescript
import { OrderType, OrderSide } from 'topstepx';

const oco = await client.placeOCO({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  orderA: {
    type: OrderType.Limit,
    side: OrderSide.Ask,
    size: 1,
    limitPrice: 5100.00, // Take profit
  },
  orderB: {
    type: OrderType.Stop,
    side: OrderSide.Ask,
    size: 1,
    stopPrice: 4900.00, // Stop loss
  },
  timeoutMs: 60000, // Optional: cancel both after 60 seconds
});

console.log('OCO placed:', oco.orderIdA, oco.orderIdB);

// Wait for one to fill
const result = await oco.result;
console.log('Filled:', result.filledOrderId);
console.log('Cancelled:', result.cancelledOrderId);
console.log('Both filled?', result.bothFilled);

// Manual cancellation
await oco.cancel();
```

### Bracket Orders

Entry order with stop-loss and take-profit brackets.

```typescript
// Place bracket order
const orderId = await client.placeBracketOrder({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  type: OrderType.Market,
  side: OrderSide.Bid,
  size: 1,
  stopLossTicks: 20,
  takeProfitTicks: 40,
});

// Add brackets to existing position
const bracketResult = await client.addBracketToPosition({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  stopLossTicks: 20,
  takeProfitTicks: 40,
});
```

### Multi-Target Brackets

Entry with multiple take-profit levels.

```typescript
const result = await client.placeMultiTargetBracket({
  accountId: 123,
  contractId: 'CON.F.US.EP.U25',
  side: OrderSide.Bid,
  entryType: OrderType.Market,
  entrySize: 3,
  targets: [
    { ticks: 20, size: 1 }, // Close 1 contract at +20 ticks
    { ticks: 40, size: 1 }, // Close 1 contract at +40 ticks
    { ticks: 60, size: 1 }, // Close 1 contract at +60 ticks
  ],
  stopLossTicks: 20,
});

// Wait for entry fill
const entryFill = await result.result;
console.log('Entry filled at:', entryFill.filledPrice);

// Cancel all orders
await result.cancel();
```

### ATM Strategies

At-the-money strategy templates with breakeven logic.

```typescript
const atmResult = await client.executeATMStrategy(
  123, // accountId
  'CON.F.US.EP.U25', // contractId
  OrderSide.Bid, // side
  OrderType.Market, // entryType
  undefined, // limitPrice
  undefined, // stopPrice
  {
    name: 'my-strategy',
    targets: [
      { ticks: 20, size: 1 },
      { ticks: 40, size: 1 },
    ],
    stopLoss: {
      ticks: 20,
      type: OrderType.Stop,
    },
    breakeven: {
      triggerTicks: 15, // Move to breakeven at +15 ticks profit
      offsetTicks: 2, // Lock in 2 ticks profit
    },
  }
);

// Cancel strategy
await atmResult.cancel();
```

### Trade Copier

Copy trades from one account to multiple targets.

```typescript
// Copy a single trade
await client.copyTrade(
  sourceAccountId,
  [targetAccountId1, targetAccountId2],
  {
    contractId: 'CON.F.US.EP.U25',
    side: OrderSide.Bid,
    size: 2,
  },
  {
    sizeRatio: 0.5, // Copy at 50% size
    maxSize: 5,
    tagPrefix: 'copied',
  }
);

// Continuous position mirroring
const mirror = await client.mirrorPositions(
  sourceAccountId,
  [targetAccountId1, targetAccountId2],
  {
    sizeRatio: 1.0,
    maxSize: 10,
    tagPrefix: 'mirror',
    ignoreExistingPositions: false, // Sync existing positions on start
  }
);

// Check if mirroring is active
console.log('Active:', mirror.active);

// Stop mirroring
await mirror.stop();
```

## React Hooks

### Provider

```tsx
import { TopstepXProvider } from 'topstepx/react';

function App() {
  return (
    <TopstepXProvider userName="user" apiKey="key">
      <TradingDashboard />
    </TopstepXProvider>
  );
}
```

### Account Hooks

```tsx
import { useAccounts } from 'topstepx/react';

function AccountSelector() {
  const { data: accounts, isLoading, error } = useAccounts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <select>
      {accounts?.map(account => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  );
}
```

### Position Hooks

```tsx
import { usePositions } from 'topstepx/react';

function PositionList({ accountId }: { accountId: number }) {
  const { data: positions, isLoading } = usePositions(accountId);

  return (
    <ul>
      {positions?.map(position => (
        <li key={position.contractId}>
          {position.contractId}: {position.size} @ {position.averagePrice}
        </li>
      ))}
    </ul>
  );
}
```

### Order Hooks

```tsx
import { useOrders, useOpenOrders } from 'topstepx/react';

function OrderBook({ accountId }: { accountId: number }) {
  // All orders (REST only)
  const { data: allOrders } = useOrders({ accountId });
  
  // Open orders with real-time updates
  const { data: openOrders } = useOpenOrders(accountId);

  return (
    <div>
      <h2>Open Orders ({openOrders?.length ?? 0})</h2>
      {/* Render orders */}
    </div>
  );
}
```

### Trade Hooks

```tsx
import { useTrades } from 'topstepx/react';

function TradeHistory({ accountId }: { accountId: number }) {
  const { data: trades, isLoading } = useTrades(accountId);

  return (
    <table>
      <tbody>
        {trades?.map(trade => (
          <tr key={trade.id}>
            <td>{trade.timestamp}</td>
            <td>{trade.side}</td>
            <td>{trade.size}</td>
            <td>{trade.price}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Market Data Hooks

```tsx
import { useBars, useContracts } from 'topstepx/react';

function PriceChart({ contractId }: { contractId: string }) {
  const { data: bars } = useBars(contractId, {
    unit: BarUnit.Minute,
    unitNumber: 5,
    limit: 100,
  });

  return <Chart data={bars} />;
}

function ContractSearch() {
  const { data: contracts } = useContracts({ searchText: 'ES' });
  return <ContractList contracts={contracts} />;
}
```

### Hub Hooks

```tsx
import { useUserHub, useMarketHub } from 'topstepx/react';

function RealTimeMonitor({ accountId }: { accountId: number }) {
  const userHub = useUserHub();
  const marketHub = useMarketHub();

  // Subscribe to updates
  useEffect(() => {
    if (userHub.isConnected) {
      userHub.subscribeOrders(accountId);
      userHub.subscribePositions(accountId);
    }
  }, [userHub.isConnected, accountId]);

  return (
    <div>
      <div>User Hub: {userHub.state}</div>
      <div>Market Hub: {marketHub.state}</div>
    </div>
  );
}
```

### Hook Types

All hooks return a `QueryResult<T>`:

```typescript
interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
}
```

## Error Handling

The SDK throws typed errors for different failure scenarios:

```typescript
import { ApiError, AuthError, RateLimitError, ConnectionError } from 'topstepx';

try {
  await client.orders.place({ ... });
} catch (error) {
  if (error instanceof AuthError) {
    console.log('Authentication failed:', error.message);
    // Token expired or invalid credentials
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
    // Too many requests
  } else if (error instanceof ApiError) {
    console.log('API error:', error.statusCode, error.message);
    // API returned error response
  } else if (error instanceof ConnectionError) {
    console.log('Connection error:', error.message);
    // WebSocket connection issues
  }
}
```

## TypeScript

The SDK is written in TypeScript and provides full type definitions.

### Core Types

```typescript
import type {
  Account,
  Contract,
  Position,
  Order,
  Trade,
  Bar,
  GatewayQuote,
  GatewayDepth,
} from 'topstepx';
```

### Event Types

```typescript
import type {
  GatewayUserOrder,
  GatewayUserPosition,
  GatewayUserTrade,
  GatewayUserAccount,
} from 'topstepx';
```

## Enums

### OrderType

| Enum | Value | Description |
|------|-------|-------------|
| `OrderType.Unknown` | 0 | Unknown order type |
| `OrderType.Limit` | 1 | Limit order |
| `OrderType.Market` | 2 | Market order |
| `OrderType.StopLimit` | 3 | Stop-limit order |
| `OrderType.Stop` | 4 | Stop order |
| `OrderType.TrailingStop` | 5 | Trailing stop order |
| `OrderType.JoinBid` | 6 | Join bid order |
| `OrderType.JoinAsk` | 7 | Join ask order |

### OrderSide

| Enum | Value | Description |
|------|-------|-------------|
| `OrderSide.Bid` | 0 | Buy |
| `OrderSide.Ask` | 1 | Sell |

### OrderStatus

| Enum | Value | Description |
|------|-------|-------------|
| `OrderStatus.None` | 0 | No status |
| `OrderStatus.Open` | 1 | Order is open/working |
| `OrderStatus.Filled` | 2 | Order has been filled |
| `OrderStatus.Cancelled` | 3 | Order has been cancelled |
| `OrderStatus.Expired` | 4 | Order has expired |
| `OrderStatus.Rejected` | 5 | Order was rejected |
| `OrderStatus.Pending` | 6 | Order is pending |

### PositionType

| Enum | Value | Description |
|------|-------|-------------|
| `PositionType.Undefined` | 0 | Undefined position type |
| `PositionType.Long` | 1 | Long position |
| `PositionType.Short` | 2 | Short position |

### BarUnit

| Enum | Value | Description |
|------|-------|-------------|
| `BarUnit.Second` | 1 | Seconds |
| `BarUnit.Minute` | 2 | Minutes |
| `BarUnit.Hour` | 3 | Hours |
| `BarUnit.Day` | 4 | Days |
| `BarUnit.Week` | 5 | Weeks |
| `BarUnit.Month` | 6 | Months |

### TradeLogType

| Enum | Value | Description |
|------|-------|-------------|
| `TradeLogType.Buy` | 0 | Buy trade |
| `TradeLogType.Sell` | 1 | Sell trade |

### DomType

| Enum | Value | Description |
|------|-------|-------------|
| `DomType.Unknown` | 0 | Unknown DOM type |
| `DomType.Ask` | 1 | Ask level |
| `DomType.Bid` | 2 | Bid level |
| `DomType.BestAsk` | 3 | Best ask |
| `DomType.BestBid` | 4 | Best bid |
| `DomType.Trade` | 5 | Trade |
| `DomType.Reset` | 6 | Reset |
| `DomType.Low` | 7 | Low |
| `DomType.High` | 8 | High |
| `DomType.NewBestBid` | 9 | New best bid |
| `DomType.NewBestAsk` | 10 | New best ask |
| `DomType.Fill` | 11 | Fill |

## Subpath Exports

The package provides two entry points:

- **`topstepx`** -- Core SDK. REST client, WebSocket hubs, order builder, types. Works in any Node.js 18+ environment with no additional dependencies.
- **`topstepx/react`** -- React hooks and provider. Wraps the core SDK with `useAccounts`, `usePositions`, `useOrders`, `useTrades`, and more. Requires React 18+ or 19+ as a peer dependency.

React is an optional peer dependency. If you only use `topstepx` (not `topstepx/react`), you do not need React installed.

## Requirements

- Node.js >= 18
- React 18+ or 19+ (optional, for hooks only)

## License

MIT
