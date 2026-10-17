import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

export enum QueueName {
  BOOKING_CREATED        = 'booking.created',
  BOOKING_STATUS_CHANGED = 'booking.status_changed',
  BOOKING_DISPATCHED     = 'booking.dispatched',
  PAYMENT_PROCESSED      = 'payment.processed',
  PENALTY_CHARGED        = 'penalty.charged',
  NOTIFICATION_SEND      = 'notification.send',
  WORKER_VERIFIED        = 'worker.verified',
  WORKER_REJECTED        = 'worker.rejected',
}

let connection: ChannelModel | null = null;
let channel:    Channel      | null = null;

const rmqLog = (level: string, event: string, extra?: object) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: 'rabbitmq-client', event, ...extra }));

export const connectRabbitMQ = async (url: string): Promise<Channel> => {
  connection = await amqplib.connect(url);

  // These fire for broker-level issues (auth failures, connection drops, etc.)
  // "Connection not authenticating" in Docker logs means one of these fired on the broker side
  (connection as any).on('error', (err: Error) =>
    rmqLog('error', 'RABBITMQ_CONNECTION_ERROR', { error: err?.message }),
  );
  (connection as any).on('close', () =>
    rmqLog('warn', 'RABBITMQ_CONNECTION_CLOSED'),
  );
  (connection as any).on('blocked', (reason: string) =>
    rmqLog('warn', 'RABBITMQ_CONNECTION_BLOCKED', { reason }),
  );

  channel    = await connection.createChannel();

  // Assert all queues
  for (const queue of Object.values(QueueName)) {
    await channel.assertQueue(queue, { durable: true });
  }

  console.log('[RabbitMQ] Connected and queues asserted');
  return channel!;
};

export const publishEvent = <T>(queue: QueueName, payload: T): void => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.sendToQueue(
    queue,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true },
  );
};

export const consumeEvent = <T>(
  queue: QueueName,
  handler: (payload: T) => Promise<void>,
): void => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.consume(queue, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as T;
      await handler(payload);
      channel!.ack(msg);
    } catch (err) {
      console.error(`[RabbitMQ] Error processing ${queue}:`, err);
      channel!.nack(msg, false, false); // dead-letter
    }
  });
};

export const closeRabbitMQ = async (): Promise<void> => {
  await channel?.close();
  await connection?.close();
};
