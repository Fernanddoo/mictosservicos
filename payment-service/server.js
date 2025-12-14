const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const { Kafka } = require('kafkajs');
const axios = require('axios');
const amqp = require('amqplib');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

let channel;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672';
const QUEUE_NAME = 'payment_notifications';

async function connectRabbit() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('Conectado ao RabbitMQ para enviar notificações.');
    } catch (error) {
        console.error('Erro ao conectar RabbitMQ:', error.message);
    }
}

// Função auxiliar para publicar na fila
function publishNotification(data) {
    if (!channel) {
        console.error("RabbitMQ não está pronto, notificação perdida.");
        return;
    }
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log(`[EVENTO] Notificação enviada para a fila: Pedido ${data.orderId}`);
}

// Kafka
const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092']
});
const consumer = kafka.consumer({ groupId: 'payment-group' });

async function runKafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'order-created', fromBeginning: true });

    console.log('Payment Service ouvindo Kafka...');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const orderData = JSON.parse(message.value.toString());
            console.log(`[KAFKA] Recebido pedido: ${orderData.orderId}`);
            try {
                // Verifica se já existe
                const exists = await prisma.payment.findFirst({ where: { orderId: orderData.orderId } });
                
                if (!exists) {
                    await prisma.payment.create({
                        data: {
                            orderId: orderData.orderId,
                            status: 'PENDING_PROCESS', // Status novo: Esperando usuário clicar em "Pagar"
                            value: new Prisma.Decimal(orderData.total),
                            paymentMethod: null, // Será definido na rota /process
                            success: false
                        }
                    });
                    console.log(`[DB] Pagamento pré-criado para pedido ${orderData.orderId}`);
                }
            } catch (err) {
                console.error('Erro ao salvar pagamento do Kafka', err);
            }
        },
    });
}
runKafkaConsumer()

const ORDER_SERVICE = process.env.ORDER_SERVICE_URL;
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL;

// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, payment-service!')
})

// POST /payments/:orderId/process Processa um pagamento
app.post('/payments/:orderId/process', async (req, res) => {
    const { orderId } = req.params;
    const { paymentMethod } = req.body; // "PIX", "CREDITO"

    try {
        const paymentRecord = await prisma.payment.findFirst({
            where: { orderId: orderId }
        });

        if (!paymentRecord) {
            return res.status(404).json({ error: 'Pedido não encontrado ou ainda não processado pelo Kafka' });
        }

        if (paymentRecord.status === 'PAID') {
            return res.status(400).json({ error: 'Pedido já pago' });
        }

        const isSuccess = Math.random() > 0.2; 

        // Atualiza o Banco Local
        const updatedPayment = await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
                paymentMethod: paymentMethod,
                success: isSuccess,
                status: isSuccess ? 'PAID' : 'FAILED'
            }
        });

        publishNotification({
            orderId: orderId,
            status: isSuccess ? 'APROVADO' : 'RECUSADO',
            message: isSuccess ? 'Seu pagamento foi confirmado!' : 'Pagamento recusado.'
        });

        if (isSuccess) {
            try {
                await axios.patch(`${ORDER_SERVICE}/pedidos/${orderId}/status`, { status: 'PAGO' });
                console.log(`[AXIOS] Order ${orderId} atualizado para PAGO`);
            } catch (axiosErr) {
                console.error(`[ERRO] Falha ao atualizar Order Service: ${axiosErr.message}`);
            }
        }

        if (isSuccess) {
            res.status(200).json({ message: 'Pagamento processado com sucesso', data: updatedPayment });
        } else {
            res.status(400).json({ message: 'Pagamento recusado', data: updatedPayment });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
});


const PORT_SERVER = process.env.PORT_SERVER || 3003;
app.listen(PORT_SERVER, () => {
    console.log(`Payment-service rodando na porta ${PORT_SERVER}`);
    connectRabbit();
});