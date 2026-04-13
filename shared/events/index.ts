import amqplib, { Channel, Connection } from 'amqplib';

export enum QueueName {
  BOOKING_CREATED        = 'booking.created',
  BOOKING_STATUS_CHANGED = 'booking.status_changed',
  PAYMENT_PROCESSED      = 'payment.processed',
  PENALTY_CHARGED        = 'penalty.charged',
  NOTIFICATION_SEND      = 'notification.send',
  WORKER_VERIFIED        = 'worker.verified',
  WORKER_REJECTED        = 'worker.rejected',
}

let connection: Connection | null = null;
let channel:    Channel    | null = null;

export const connectRabbitMQ = async (url: string): Promise<Channel> => {
  connection = await amqplib.connect(url);
  channel    = await connection.createChannel();

  // Assert all queues
  for (const queue of Object.values(QueueName)) {
    await channel.assertQueue(queue, { durable: true });
  }

  console.log('[RabbitMQ] Connected and queues asserted');
  return channel;
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
  channel.consume(queue, async (msg) => {
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
