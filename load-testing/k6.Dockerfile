FROM grafana/xk6:latest AS builder

WORKDIR /app

RUN xk6 build --with github.com/grafana/xk6-output-influxdb

FROM grafana/k6:latest

COPY --from=builder /app/k6 /usr/bin/k6

