export interface CreatePaymentParams {
  orderId: string        // used as Square idempotency key (orders.id UUID)
  amountCents: number    // whole cents — e.g. $12.50 → 1250
  currency: string       // 'USD'
  nonce?: string         // Square: tokenized card sourceId from Web Payments SDK
  paypalOrderId?: string // PayPal: order ID to capture after user approval
}

export interface PaymentResult {
  success: boolean
  transactionId?: string // stored in orders.payment_transaction_id; used for refunds
  error?: string
}

export interface RefundParams {
  transactionId: string  // orders.payment_transaction_id
  amountCents: number    // amount to refund in cents
  orderId: string        // used as idempotency key prefix
}

export interface RefundResult {
  success: boolean
  error?: string
}

export interface VerifyWebhookParams {
  rawBody: string
  headers: Record<string, string>
}

export interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>
  refundPayment(params: RefundParams): Promise<RefundResult>
  verifyWebhook(params: VerifyWebhookParams): boolean
}
