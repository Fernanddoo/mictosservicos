const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// GET genérico
app.get('/', (req, res) => {
    res.send('Ta rodando, user-service!')
})

// GET /users: Retorna todos os usuários
app.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: "Não foi possível encontrar usuários." });
    }
});

// GET /users/:id: Retorna um usuário específico
app.get('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Não foi possível encontrar o usuário." });
    }
});

// POST /users: Cadastra um novo usuário
app.post('/users', async (req, res) => {
    const { name, email, role } = req.body; // 'role' é opcional
    if (!name || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }
    try {
        const newUser = await prisma.user.create({
            data: { 
                name, 
                email,
                // Se o 'role' não for enviado na requisição, o Prisma usará o padrão 'CLIENT'
                role: role 
            },
        });
        res.status(201).json(newUser);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: 'Não foi possível cadastrar o usuário.' });
    }
});

const PORT_SERVER = process.env.PORT_SERVER || 3000;
app.listen(PORT_SERVER, () => {
    console.log(`User-service rodando na porta ${PORT_SERVER}`);
});