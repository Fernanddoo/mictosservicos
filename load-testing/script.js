import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    scenarios: {
        // Estresse apenas na leitura de produtos 
        stress_browse: {
            executor: 'ramping-vus',
            exec: 'browseFlow', 
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 }, // Sobe para 50 usuários
                { duration: '1m', target: 50 },  // Mantém
                { duration: '10s', target: 0 },  // Desce
            ],
            tags: { my_service: 'product-service' }, // Tag para o Grafana
        },

        // Estresse na criação de pedidos 
        stress_order: {
            executor: 'ramping-vus',
            exec: 'orderFlow', 
            startVUs: 0,
            stages: [
                { duration: '30s', target: 20 }, 
                { duration: '1m', target: 20 },
                { duration: '10s', target: 0 },
            ],
            tags: { my_service: 'order-service' },
        },

        // Estresse no pagamento 
        stress_payment: {
            executor: 'ramping-vus',
            exec: 'paymentFlow', 
            startVUs: 0,
            stages: [
                { duration: '30s', target: 15 }, 
                { duration: '1m', target: 15 },
                { duration: '10s', target: 0 },
            ],
            tags: { my_service: 'payment-service' },
        },
    },
    thresholds: {
        'http_req_duration{my_service:product-service}': ['p(95)<200'], 
        'http_req_duration{my_service:order-service}': ['p(95)<500'],  
        'http_req_duration{my_service:payment-service}': ['p(95)<1000'], 
    },
};

// URLs 
const USER_SERVICE_URL = 'http://user-service:3000';
const PRODUCT_SERVICE_URL = 'http://product-service:3001';
const ORDER_SERVICE_URL = 'http://order-service:3002';
const PAYMENT_SERVICE_URL = 'http://payment-service:3003';

// SETUP
export function setup() {
    console.log('--- Configurando dados de teste ---');
    
    // Cria Usuário
    const uniqueEmail = `teste-carga-${Date.now()}@k6.io`;
    let userPayload = JSON.stringify({ name: 'User Carga', email: uniqueEmail });
    let userRes = http.post(`${USER_SERVICE_URL}/users`, userPayload, { headers: { 'Content-Type': 'application/json' } });
    const userId = userRes.json('id');

    // Cria Produto
    let productPayload = JSON.stringify({ name: 'Produto Carga', price: 50.00, stock: 1000000 });
    let productRes = http.post(`${PRODUCT_SERVICE_URL}/produtos`, productPayload, { headers: { 'Content-Type': 'application/json' } });
    const productId = productRes.json('id');
    
    if (!userId || !productId) {
        throw new Error('Falha no Setup! Verifique se os serviços estão rodando.');
    }
    
    return { userId, productId };
}

// Navegação (Teste Product Service)
export function browseFlow(data) {
    let res = http.get(`${PRODUCT_SERVICE_URL}/produtos/${data.productId}`);
    check(res, { 'GET Produto 200': (r) => r.status === 200 });
    sleep(1);
}

// Pedido (Teste Order Service) 
export function orderFlow(data) {
    let orderPayload = JSON.stringify({
        userId: data.userId,
        items: [{ productId: data.productId, quantity: 1 }]
    });
    
    let res = http.post(`${ORDER_SERVICE_URL}/pedidos`, orderPayload, { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'Criar Pedido 201': (r) => r.status === 201 });
    sleep(1);
}

// Pagamento (Teste Payment Service) 
export function paymentFlow(data) {
    let orderPayload = JSON.stringify({
        userId: data.userId,
        items: [{ productId: data.productId, quantity: 1 }]
    });
    let resOrder = http.post(`${ORDER_SERVICE_URL}/pedidos`, orderPayload, { headers: { 'Content-Type': 'application/json' } });
    
    if (resOrder.status === 201) {
        let order = resOrder.json();
       
        let paymentPayload = JSON.stringify({
            orderId: order._id,
            paymentMethod: 'PIX',
            value: parseFloat(order.total.$numberDecimal), 
            products: order.products 
        });

        let resPay = http.post(`${PAYMENT_SERVICE_URL}/payments`, paymentPayload, { headers: { 'Content-Type': 'application/json' } });
        
        check(resPay, { 'Processar Pagamento 201/400': (r) => r.status === 201 || r.status === 400 });
    }
    sleep(1);
}