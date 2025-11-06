FROM grafana/xk6:latest AS builder

# Define o diretório de trabalho
WORKDIR /app

# Roda o comando de build para criar um 'k6' com a extensão do InfluxDB
RUN xk6 build --with github.com/grafana/xk6-output-influxdb


FROM grafana/k6:latest


COPY --from=builder /app/k6 /usr/bin/k6

