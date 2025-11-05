const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Order = require('./models/Order');

const app = express();
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('MongoDB conectado ao order-service'))
    .catch(err => console.error(err));

const USER_SERVICE = process.env.USER_SERVICE_URL;
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL;
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL;

// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, order-service!')
})

// GET /pedidos/ Busca todos
app.get('/pedidos', async (req, res) => {
     try {
        // Usa o model 'Order' para buscar todos os documentos na coleção de pedidos
        // .sort({ createdAt: -1 }) ordena os resultados pela data de criação, do mais novo para o mais antigo
        const orders = await Order.find({}).sort({ createdAt: -1 });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: "Não foi possível buscar os pedidos." });
    }
})

// GET /pedidos/:id: Busca um pedido específico
app.get('/pedidos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        res.status(200).json(order);
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID do pedido inválido.' });
        }
        res.status(500).json({ error: 'Não foi possível buscar o pedido.' });
    }
});

// POST /pedidos: Cria um novo pedido 
app.post('/pedidos', async (req, res) => {
    const { userId, items } = req.body;

    if (!userId || !items || !items.length === 0) {
        return res.status(400).json({ error: 'O pedido precisa ter um usuário e pelo menos um item.' });
    }

    try {
        // Verifica se o usuário existe E JÁ PEGA SEUS DADOS
        const userResponse = await axios.get(`${USER_SERVICE}/users/${userId}`);
        const user = userResponse.data; // Agora a variável 'user' existe!

        // verifica a role do usuário
        if (user.role !== 'CLIENT') {
            // return para parar a execução e enviar a resposta de erro
            return res.status(403).json({ error: 'Apenas usuários com a função de CLIENTE podem criar pedidos.' });
        }

        // Buscar informações dos produtos e verificar estoque
        const productIds = items.map(item => item.productId);
        const productRequests = productIds.map(id => axios.get(`${PRODUCT_SERVICE}/produtos/${id}`));
        const productResponses = await Promise.all(productRequests);
        const productsData = productResponses.map(response => response.data);

        let totalOrderValue = 0;
        const orderProducts = [];

        for (const item of items) {
            const product = productsData.find(p => p.id === item.productId);
            if (!product) {
                throw new Error(`Produto com ID ${item.productId} não encontrado.`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Estoque insuficiente para "${product.name}".`);
            }
            totalOrderValue += parseFloat(product.price) * item.quantity;
            orderProducts.push({
                productId: product.id,
                name: product.name,
                quantity: item.quantity,
                price: product.price
            });
        }

        // Se tudo deu certo, criar o pedido no MongoDB
        const newOrder = new Order({
            userId: userId, 
            total: totalOrderValue,
            products: orderProducts,
            status: 'AGUARDANDO_PAGAMENTO',
        });
        await newOrder.save();

        res.status(201).json(newOrder);

    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data.error : error.message;
        res.status(status).json({ error: `Falha ao criar pedido: ${message}` });
    }
});

app.patch('/pedidos/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    try {
        const order = await Order.findByIdAndUpdate(
            id,
            { $set: { status: status } },
            { new: true } // Retorna o documento atualizado
        );

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }
        
        console.log(`[Order Service] Pedido ${id} atualizado para ${status}`);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: 'Falha ao atualizar status do pedido.' });
    }
});

const PORT_SERVER = process.env.PORT_SERVER || 3002;
app.listen(PORT_SERVER, () => {
    console.log(`Order-service rodando na porta ${PORT_SERVER}`);
});