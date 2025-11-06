import http from 'k6/http';
import { check, sleep, group } from 'k6';

// --- DEFINIÇÃO DA CARGA ---
export const options = {
    stages: [
        { duration: '30s', target: 20 }, // Sobe de 0 para 20 usuários em 30 segundos
        { duration: '1m', target: 20 },  // Mantém 20 usuários por 1 minuto (teste de stress)
        { duration: '10s', target: 0 },  // Desce para 0 usuários
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'], // 95% das requisições devem ser abaixo de 500ms
        'checks': ['rate>0.99'], // 99% dos 'checks' devem passar
    },
};

// --- URLs DOS SERVIÇOS ---
const USER_SERVICE_URL = 'http://user-service:3000';
const PRODUCT_SERVICE_URL = 'http://product-service:3001';
const ORDER_SERVICE_URL = 'http://order-service:3002';
const PAYMENT_SERVICE_URL = 'http://payment-service:3003';

// --- FUNÇÃO DE SETUP ---
export function setup() {
    console.log('--- Configurando dados de teste ---');
    
    // Criar um usuário de teste com email 100% único
    const uniqueEmail = `teste-carga-${Date.now()}@k6.io`; // Usa o timestamp
    let userPayload = JSON.stringify({ name: 'Usuário de Teste Carga', email: uniqueEmail });
    let userRes = http.post(`${USER_SERVICE_URL}/users`, userPayload, { headers: { 'Content-Type': 'application/json' } });
    
    // Verifica se o usuário foi criado com sucesso
    check(userRes, { 'Setup: Criar Usuário status 201': (r) => r.status === 201 });
    const userId = userRes.json('id');

    // Criar um produto de teste
    let productPayload = JSON.stringify({ name: 'Produto de Teste', price: 99.99, stock: 10000 });
    let productRes = http.post(`${PRODUCT_SERVICE_URL}/produtos`, productPayload, { headers: { 'Content-Type': 'application/json' } });
    
    // Verifica se o produto foi criado com sucesso
    check(productRes, { 'Setup: Criar Produto status 201': (r) => r.status === 201 });
    const productId = productRes.json('id');
    
    console.log(`Usuário de Teste: ${userId}, Produto de Teste: ${productId}`);
    
    // Se a criação falhar, aborta o teste
    if (!userId || !productId) {
        throw new Error('Falha ao criar dados de setup (usuário ou produto). Teste abortado.');
    }
    
    return { userId, productId };
}

// --- FUNÇÃO PRINCIPAL ---
export default function (data) {

    // --- GRUPO: NAVEGAÇÃO ---
    group('Navegação de Produtos', function () {
        let res = http.get(`${PRODUCT_SERVICE_URL}/produtos`);
        check(res, { 'GET /produtos status 200': (r) => r.status === 200 });
        sleep(0.5); // Usuário "pensa" por 0.5s

        res = http.get(`${PRODUCT_SERVICE_URL}/produtos/${data.productId}`);
        check(res, { 'GET /produtos/:id status 200': (r) => r.status === 200 });
        sleep(0.5);
    });

    // --- GRUPO: CRIAÇÃO DO PEDIDO ---
    let order = null;
    group('Criação de Pedido', function () {
        let orderPayload = JSON.stringify({
            userId: data.userId,
            items: [{ productId: data.productId, quantity: 1 }]
        });
        
        let res = http.post(`${ORDER_SERVICE_URL}/pedidos`, orderPayload, { headers: { 'Content-Type': 'application/json' } });
        check(res, { 'POST /pedidos status 201': (r) => r.status === 201 });
        
        if (res.status === 201) {
            order = res.json(); 
        }
    });

    sleep(1); // Usuário "preenche" os dados de pagamento

    // --- GRUPO: PROCESSAMENTO DO PAGAMENTO ---
    // Só tenta pagar se o pedido foi criado com sucesso
    if (order) {
        group('Processamento de Pagamento', function () {
            let paymentPayload = JSON.stringify({
                orderId: order._id,
                paymentMethod: 'PIX', // Usa um método de pagamento válido
                value: parseFloat(order.total.$numberDecimal), 
                products: order.products 
            });

            let res = http.post(`${PAYMENT_SERVICE_URL}/payments`, paymentPayload, { headers: { 'Content-Type': 'application/json' } });
            
            // O pagamento pode ter sucesso (201) ou falha simulada (400), ambos são OK
            check(res, { 'POST /payments status 201 ou 400': (r) => r.status === 201 || r.status === 400 });
        });
    }

    // Espera 1 segundo antes de simular o próximo
    sleep(1);
}