# Ajuste de Lotes

Micro SaaS para planejamento de operações MNQ/USTEC e cálculo algébrico de ajustes. O sistema não envia ordens a corretoras e não promete resultados: é uma ferramenta de planejamento.

## O que está incluído

- Login e cadastro com JWT, senha protegida com bcrypt e dados isolados por usuário.
- CRUD completo de operações e status.
- Cálculos de Mesa MNQ e Conta Real USTEC no backend usando `decimal.js`.
- Ajuste individual por meta, com três modos de cálculo.
- Contratos e ticks MNQ sempre inteiros; lotes USTEC respeitam mínimo, máximo e step.
- Ajuste combinado para visualizar impacto nos quatro cenários.
- Histórico de ajustes sem alterar os valores originais.
- Configurações de instrumentos, corretora e locale por usuário.
- SQLite com migrations automáticas.
- Interface React responsiva: tabela no desktop e cards no celular.
- Testes automatizados dos casos obrigatórios.

## Iniciar com Docker

```bash
docker compose up -d --build
```

Acesse [http://localhost:3000](http://localhost:3000) e crie a primeira conta. O banco fica persistido no volume `ajuste_data`.

Para produção, crie um arquivo `.env` a partir de `.env.example` e defina um `JWT_SECRET` longo e aleatório.

## Desenvolvimento local

Requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000

O Vite redireciona `/api` para a API local. Para executar o frontend separadamente contra outra URL, defina `VITE_API_URL`.

## Testes e build

```bash
npm test
npm run build
```

## Endpoints principais

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- `POST /api/operations`, `GET /api/operations`, `GET /api/operations/:id`
- `PUT /api/operations/:id`, `DELETE /api/operations/:id`
- `POST /api/operations/:id/adjustments`, `GET /api/operations/:id/adjustments`
- `POST /api/calculate`, `POST /api/calculate-adjustment`, `POST /api/calculate-combined`
- `GET /api/settings`, `PUT /api/settings`

Todas as rotas, exceto autenticação e health check, exigem `Authorization: Bearer <token>`.

## Regras de cálculo

- Mesa: `ticks × contratos × valor_do_tick`
- Real: `ticks_MNQ × tamanho_do_tick × lote × valor_por_ponto`
- Ajuste: `meta - resultado_realizado`

Valores monetários são serializados como strings decimais. O código nunca usa `Math.abs` para definir o lado financeiro do ajuste; o sinal vem do saldo algébrico.
