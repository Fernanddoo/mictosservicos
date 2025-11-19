# microsservicos

### faltou/corrigir:

- mais de um tipo de método de pagamento. OK
- mover lógica do :id/pagmentos para o serviço de pagamento. OK
- aplicar migration nos docker files dos bancos. OK
- aplicar axios nos chamados pedido -> pagamento e depois pagamento -> pedido e produto. OK
- deleção lógica dos produtos. OK

### Próximo passo:

- teste de carga (ver quanto um endpoint é requisitado) (k6 + influxdb + grafana) descobrir quanto a aplicação aguenta. OK

- para rodar o teste:

```bash
    docker-compose run --rm k6 run --out influxdb=http://influxdb:8086/k6-payments /scripts/script.js
```

### Novas etapas:

06/11

- Separar os testes para cada endpoint para identificar o maior gargalo
- Separar notificação em um microsserviço também

### Implementar

- RabbitMQ para notificações, consumindo de pedido
- Criar uma fila para ler as notificações
- notificação não é mais sincrona com o pagamento, não parte mais dele
