#!/bin/bash
set -e

echo "Criando bancos do k6..."

until influx -execute 'SHOW DATABASES'; do
  echo "Esperando o InfluxDB subir..."
  sleep 2
done

influx -execute 'CREATE DATABASE "k6-payments"'
influx -execute 'CREATE DATABASE "k6-orders"'

echo "Bancos criados com sucesso!"
