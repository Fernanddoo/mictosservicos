const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672';
const QUEUE_NAME = 'payment_notifications';

async function startConsumer() {
    try {
        console.log('Tentando conectar ao RabbitMQ...');
        // Conecta ao RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Garante que a fila existe (Idempotência)
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log(`[*] Aguardando mensagens na fila: ${QUEUE_NAME}`);

        // Consome a mensagem"
        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                
                console.log("--- 🔔 NOTIFICAÇÃO RECEBIDA ---");
                console.log(`Pedido ID: ${content.orderId}`);
                console.log(`Status: ${content.status}`);
                console.log(`Mensagem: ${content.message}`);
                console.log("-----------------------------");

                // Confirma o recebimento (ACK) para retirar da fila
                channel.ack(msg);
            }
        });

    } catch (error) {
        console.error('Erro ao conectar no RabbitMQ (Tentando novamente em 5s):', error.message);
        setTimeout(startConsumer, 5000); // Retry simples
    }
}

startConsumer();