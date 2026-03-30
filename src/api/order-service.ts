import type { HttpClient } from '../http/http-client.js';
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderSearchRequest,
  OrderSearchOpenRequest,
  CancelOrderRequest,
  ModifyOrderRequest,
  OrderSearchResponse,
  CancelOrderResponse,
  ModifyOrderResponse,
  Order,
} from '../types/index.js';

export class OrderService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async place(request: PlaceOrderRequest): Promise<number> {
    const response = await this.http.post<PlaceOrderResponse>(
      '/api/Order/place',
      request,
      { retries: 0 },
    );
    return response.orderId;
  }

  async search(request: OrderSearchRequest): Promise<Order[]> {
    const response = await this.http.post<OrderSearchResponse>(
      '/api/Order/search',
      request,
    );
    return response.orders;
  }

  async searchOpen(request: OrderSearchOpenRequest): Promise<Order[]> {
    const response = await this.http.post<OrderSearchResponse>(
      '/api/Order/searchOpen',
      request,
    );
    return response.orders;
  }

  async cancel(request: CancelOrderRequest): Promise<void> {
    await this.http.post<CancelOrderResponse>(
      '/api/Order/cancel',
      request,
    );
  }

  async modify(request: ModifyOrderRequest): Promise<void> {
    await this.http.post<ModifyOrderResponse>(
      '/api/Order/modify',
      request,
    );
  }
}
