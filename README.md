# Android Tech Cell — V5.1 Mercado Pago

Plataforma Next.js + PostgreSQL + Prisma com clientes, créditos, pedidos, painel administrativo e PIX via Mercado Pago.

## Configuração local
1. Node.js 20+ e Docker Desktop.
2. Copie `.env.example` para `.env`.
3. Defina `JWT_SECRET` e `ADMIN_PASSWORD` fortes.
4. Para PIX, defina `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `APP_URL`.
5. `docker compose up -d`
6. `npm install`
7. `npx prisma generate`
8. `npm run db:push`
9. `npm run seed`
10. `npm run dev`

## Mercado Pago
O servidor cria Pix em `POST /v1/payments` usando `payment_method_id=pix`, idempotência e `external_reference` do pagamento interno. O token privado fica exclusivamente no servidor.

Configure o evento de pagamentos no Mercado Pago para:
`https://SEU-DOMINIO.COM/api/payments/pix/webhook`

O webhook valida `x-signature`, consulta o pagamento na API do Mercado Pago e somente um pagamento aprovado pode gerar créditos. O processamento é idempotente para evitar crédito duplicado.

A tela do cliente também consulta o status do pagamento periodicamente para atualizar a interface sem exigir recarregamento.

## Produção
- Use HTTPS e banco gerenciado com backup.
- Nunca publique `.env` ou Access Token.
- Configure rate limiting, logs e monitoramento no servidor.
- Use credenciais de teste antes de produção.
- Configure o domínio público em `APP_URL` para o webhook.

As integrações de serviços devem ser apenas APIs autorizadas. Esta base não implementa bypass de FRP, contas ou mecanismos de segurança.
