const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
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
connectRabbit(); 

// Função auxiliar para publicar na fila
function publishNotification(data) {
    if (!channel) {
        console.error("RabbitMQ não está pronto, notificação perdida.");
        return;
    }
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log(`[EVENTO] Notificação enviada para a fila: Pedido ${data.orderId}`);
}

const ORDER_SERVICE = process.env.ORDER_SERVICE_URL;
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL;

// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, payment-service!')
})

// POST /payments: Processa um pagamento
app.post('/payments', async (req, res) => {
    const { orderId, paymentMethod, value, products } = req.body; 
    if (!orderId || !paymentMethod || !value || !products) {
        return res.status(400).json({ error: 'Dados do pagamento incompletos (precisa de orderId, paymentMethod, value, products).' });
    }

    const success = Math.random() > 0.2; // 80% de chance de sucesso

    try {
        const payment = await prisma.payment.create({
            data: {
                orderId: orderId,
                paymentMethod,
                value: new Prisma.Decimal(value),
                success,
            }
        });

        if (payment.success) {
            try {
                // Avisa o product-service para baixar o estoque
                const stockUpdatePayload = products.map(item => ({
                    productId: item.productId,
                    quantity: -item.quantity // Quantidade negativa para decrementar
                }));
                await axios.post(`${PRODUCT_SERVICE}/produtos/update-stock`, { items: stockUpdatePayload });

                await axios.patch(`${ORDER_SERVICE}/pedidos/${orderId}/status`, { status: 'PAGO' });

                publishNotification({
                    orderId: payment.orderId,
                    status: 'APROVADO',
                    message: 'Seu pagamento foi confirmado!'
                });
                
                // Retorna sucesso para o cliente
                res.status(201).json(payment);

            } catch (sagaError) {
                console.error("ERRO PÓS-PAGAMENTO:", sagaError.message);
                res.status(500).json({ error: 'Pagamento aprovado, mas falha ao atualizar pedido/estoque.' });
            }
        } else {
            // Pagamento falhou
            await axios.patch(`${ORDER_SERVICE}/pedidos/${orderId}/status`, { status: 'FALHA_NO_PAGAMENTO' });

            publishNotification({
                orderId: payment.orderId,
                status: 'RECUSADO',
                message: 'Pagamento recusado pela operadora.'
            });
            
            res.status(400).json({ message: 'Pagamento falhou.', payment });
        }

    } catch (error) {
        console.error("ERRO NO PAYMENT-SERVICE:", error);
        res.status(500).json({ error: 'Não foi possível processar o pagamento.' });
    }
});

const PORT_SERVER = process.env.PORT_SERVER || 3003;
app.listen(PORT_SERVER, () => {
    console.log(`Payment-service rodando na porta ${PORT_SERVER}`);
});