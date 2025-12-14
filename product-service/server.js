const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
});

redis.on('connect', () => console.log('Product Service conectado ao Redis!'));
redis.on('error', (err) => console.error('Erro no Redis:', err));


// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, product-service!')
})

// ROTAS DE PRODUTOS

// GET /produtos: Lista todos os produtos disponíveis.
app.get('/produtos', async (req, res) => { 
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true }
        });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: 'Não foi possível buscar os produtos.' });
    }
});

// GET /produtos/:id: Busca um produto pelo ID (cache do redis)
app.get('/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `product:${id}`;

    try {
        const cachedProduct = await redis.get(cacheKey);
        
        if (cachedProduct) {
            console.log(`[CACHE HIT] Produto ${id} vindo do Redis ⚡`);
            return res.status(200).json(JSON.parse(cachedProduct));
        }

        console.log(`[CACHE MISS] Buscando produto ${id} no Banco...`);
        const product = await prisma.product.findFirst({
            where: { 
                id: parseInt(id),
                isActive: true 
            }
        });

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        await redis.set(cacheKey, JSON.stringify(product), 'EX', 3600);

        res.status(200).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Não foi possível buscar o produto.' });
    }
});

// POST /produtos: Adiciona um novo produto.
app.post('/produtos', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const newProduct = await prisma.product.create({
      data: { name, price, stock },
    });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível criar o produto.' });
  }
});

// PUT /produtos/:id: Atualiza um produto.
app.put('/produtos/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;

  // Impede a atualização do estoque por esta rota
  if (req.body.stock !== undefined) {
    return res.status(400).json({ error: 'O estoque não pode ser atualizado por esta rota. Use o endpoint específico.' });
  }

  try {
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id, 10) },
      data: { name, price },
    });

    await redis.del(`product:${id}`);
    console.log(`[CACHE DEL] Cache do produto ${id} invalidado após update.`);

    res.status(200).json(updatedProduct);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    res.status(500).json({ error: 'Não foi possível atualizar o produto.' });
  }
});

// POST /produtos/:id/estoque: Adiciona estoque a um produto.
app.post('/produtos/:id/estoque', async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'A quantidade de estoque a ser adicionada deve ser um número inteiro positivo.' });
    }

    try {
        const updatedProduct = await prisma.product.update({
            where: { id: parseInt(id, 10) },
            data: {
                stock: {
                    increment: amount,
                },
            },
        });

        await redis.del(`product:${id}`);
        console.log(`[CACHE DEL] Cache do produto ${id} invalidado após entrada de estoque.`);

        res.status(200).json({ message: 'Estoque atualizado com sucesso.', product: updatedProduct });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        res.status(500).json({ error: 'Não foi possível atualizar o estoque do produto.' });
    }
});

// DELETE /produtos/:id Deleta o produto específico pelo ID.
app.delete('/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.product.update({
            where: { id: parseInt(id, 10) },
            data: { isActive: false }
        });

        await redis.del(`product:${id}`);
        console.log(`[CACHE DEL] Cache do produto ${id} removido (Soft Delete).`);

        res.status(204).send(); // No Content
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        res.status(500).json({ error: 'Não foi possível deletar o produto.' });
    }
});

// Usado pelo order-service para decrementar ou reverter estoque
app.post('/produtos/update-stock', async (req, res) => {
    const { items } = req.body; // items: [{ productId: 1, quantity: -2 }, { productId: 2, quantity: 2 }]

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Formato inválido." });
    }

    try {
        const updatedProducts = await prisma.$transaction(
            items.map(item => 
                prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            increment: item.quantity // Usa increment com valor negativo para decrementar
                        }
                    }
                })
            )
        );

        const keysToDelete = items.map(item => `product:${item.productId}`);
        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
            console.log(`[CACHE DEL] Itens do pedido removidos do cache: ${keysToDelete.join(', ')}`);
        }
        
        res.status(200).json(updatedProducts);
    } catch (error) {
        // P2025: Ocorre se um produto não for encontrado
        if (error.code === 'P2025') {
             return res.status(404).json({ error: 'Um ou mais produtos não foram encontrados.' });
        }
        res.status(500).json({ error: "Falha ao atualizar o estoque." });
    }
});

const PORT_SERVER = process.env.PORT_SERVER || 3001;
app.listen(PORT_SERVER, () => {
    console.log(`User-service rodando na porta ${PORT_SERVER}`);
});