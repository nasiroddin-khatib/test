# DevConnect v2

A production-oriented evolution of the original DevConnect notes application.

## What changed

### Application
- Polished responsive frontend.
- Registration, login, note create/read/update/delete.
- User-specific note authorization.
- API health and readiness endpoints.
- Rate limiting and security headers.
- Structured JSON application logs.
- Prometheus application metrics.

### Security
- No hardcoded JWT fallback.
- JWT can come from an injected `JWT_SECRET` or AWS Secrets Manager.
- CORS origins are runtime configuration.
- Database credentials come from AWS Secrets Manager.
- PostgreSQL TLS certificate validation is enabled.
- Passwords are bcrypt-hashed.
- Login response never returns the password hash.
- Parameterized SQL queries are retained.
- Database connection is controlled by network security (RDS SG/NACL/routing) and database credentials; the application does not decide whether an arbitrary network host may reach RDS.

## Production request flow

Browser
 -> CloudFront/ALB
 -> Frontend
 -> `/api`
 -> ALB listener/rule
 -> private backend
 -> Express
 -> PostgreSQL/RDS

## Observability

### Application logs
The backend writes structured JSON to:

`/var/log/devconnect/app.log` (production; local default is `./logs/app.log`)

CloudWatch Agent tails that file.

### Application metrics
Prometheus scrapes:

`GET /metrics`

Grafana visualizes Prometheus metrics.

Prometheus is for metrics/time series; it is not the log store. CloudWatch Logs is used for the application log file in this design.

### Infrastructure metrics
CloudWatch Agent collects EC2 memory/disk metrics. CloudWatch also provides native EC2 CPU/network metrics.

## Secrets

Set either:

`JWT_SECRET` (runtime environment variable)

OR:

`JWT_SECRET_SECRET_ID` (AWS Secrets Manager secret containing a JSON object such as `{"jwtSecret":"..."}` or a plain secret string).

Never put real secrets in `.env.example`, source code, frontend JavaScript, Git, or the README.

## Database TLS

Set `RDS_CA_CERT_PATH` to an RDS CA bundle on the backend host. `rejectUnauthorized` is true. Do not use `rejectUnauthorized: false` in production.

The RDS security group should allow PostgreSQL only from the backend security group, not from the public internet.

## Suggested deployment

1. Create RDS PostgreSQL in private subnets.
2. Store DB credentials in Secrets Manager.
3. Store/inject JWT secret through Secrets Manager or the runtime environment.
4. Put backend EC2 instances in private subnets.
5. Allow backend SG -> RDS SG on TCP 5432.
6. Put an ALB in front of the backend.
7. Route `/api/*` from the frontend edge/reverse proxy to the backend target group.
8. Run the backend as a managed service (systemd, ECS, or Kubernetes).
9. Install CloudWatch Agent on backend EC2 hosts.
10. Run Prometheus where it can reach the private `/metrics` endpoint.
11. Connect Grafana to Prometheus.

## Important note about db.js

Keeping database access in a separate module is not a bad architecture. It is actually a useful separation of concerns. The improvement here is to make the module responsible for secret loading, TLS configuration, pool sizing and a connectivity check, while the route handlers only use the pool.
