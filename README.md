# microsservicos

### faltou/corrigir:

- mais de um tipo de método de pagamento. OK
- mover lógica do :id/pagmentos para o serviço de pagamento. OK
- aplicar migration nos docker files dos bancos. OK
- aplicar axios nos chamados pedido -> pagamento e depois pagamento -> pedido e produto. OK
- deleção lógica dos produtos. OK

### Próximo passo:

- teste de carga (ver quanto um endpoint é requisitado) (k6 + influxdb + grafana) descobrir quanto a aplicação aguenta.

- para rodar o teste:

```bash
    docker-compose run --rm k6 run /scripts/script.js
```