# Curls - microsservicos

## User Service
curl http://localhost:3000/

### Criar um usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Professor Avaliador", "email": "prof@facul.edu.br", "role": "CLIENT"}'

curl http://localhost:3000/users/1

## Product Service
curl http://localhost:3001/

### Criar um produto
curl -X POST http://localhost:3001/produtos \
  -H "Content-Type: application/json" \
  -d '{"name": "Notebook Gamer", "price": 5000.00, "stock": 10}'

curl -X POST http://localhost:3001/produtos \
  -H "Content-Type: application/json" \
  -d '{"name": "Mouse Sem Fio", "price": 100.00, "stock": 50}'

### GET por ID
curl http://localhost:3001/produtos/1

### Atualizar estoque
curl -X POST http://localhost:3001/produtos/1/estoque \
  -H "Content-Type: application/json" \
  -d '{"amount": 5}'

## Order Service
curl http://localhost:3002/

### Criar um pedido
curl -X POST http://localhost:3002/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "items": [
        {"productId": 1, "quantity": 1},
        {"productId": 2, "quantity": 2}
    ]
}'

### GET por ID
curl http://localhost:3002/pedidos/:ORDER_ID

## Payment Service
curl http://localhost:3003/

### Criar um pagamento
curl -X POST http://localhost:3003/payments/:ORDER_ID/process \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "PIX"}'

## POSTMAN

### user-service:

- GET http://localhost:3000/users
- GET http://localhost:3000/users/1
- POSThttp://localhost:3000/users

```json
  {
    "name": "Faustão",
    "email": "fausto@gmail.com",
    "role": "CLIENT"
  }
```

### order-service:

- GET http://localhost:3002/pedidos
- POST http://localhost:3002/pedidos

```json
  {
      "userId": 1,
      "items": [
          {
              "productId": 2,
              "quantity": 10
          }
      ]
  }
```

### product-service:

- GET http://localhost:3001/produtos
- GET http://localhost:3001/produtos/1
- POST http://localhost:3001/produtos

```json
  {
      "name": "Caneca Gamer RGB",
      "price": 99.90,
      "stock": 10
  }
```
- PUT http://localhost:3001/produtos/1

```json
{
    "price": 59.90
}
```

- POST http://localhost:3001/produtos/2/estoque

```json
{
    "amount": 25
}
```

- DELETE http://localhost:3001/produtos/2

### payment-service:

- POST http://localhost:3003/payments/:ORDER_ID/process

```json
{
    "paymentMethod": "PIX"
}
```