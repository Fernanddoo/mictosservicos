const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

async function sendNotification(message, orderId) {
    console.log("--- Disparando Notificação ---");
    // Simula um pequeno atraso, como se estivesse se comunicando com um serviço externo
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    console.log(`[NOTIFICAÇÃO] Para o pedido ${orderId}: ${message}`);
    console.log("----------------------------");
}

// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, payment-service!')
})

// POST /payments: Processa um pagamento
app.post('/payments', async (req, res) => {
    const { orderId, paymentMethod, value } = req.body;

    if (!orderId || !paymentMethod || !value) {
        return res.status(400).json({ error: 'Dados do pagamento incompletos.' });
    }

    // Lógica de simulação de sucesso/falha do pagamento
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

        // --- CHAMADA DA NOTIFICAÇÃO ---
        // Dispara a notificação com base no sucesso ou falha do pagamento.
        if (payment.success) {
            sendNotification('Pagamento APROVADO com sucesso!', payment.orderId);
        } else {
            sendNotification('Pagamento RECUSADO. Por favor, tente novamente.', payment.orderId);
        }
        // -----------------------------

        // Retorna o resultado para o order-service
        res.status(201).json(payment);
    } catch (error) {
        console.error("ERRO NO PAYMENT-SERVICE:", error);
        res.status(500).json({ error: 'Não foi possível processar o pagamento.' });
    }
});

const PORT_SERVER = process.env.PORT_SERVER || 3003;
app.listen(PORT_SERVER, () => {
    console.log(`Payment-service rodando na porta ${PORT_SERVER}`);
});