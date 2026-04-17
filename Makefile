.PHONY: install dev dev-backend dev-frontend infra infra-down migrate migrate-dev db-studio build test

## Install all workspace dependencies
install:
	npm install

## Start PostgreSQL + Redis via Docker
infra:
	docker-compose -f backend/docker/docker-compose.yml up postgres redis -d

## Stop infrastructure
infra-down:
	docker-compose -f backend/docker/docker-compose.yml down

## Run DB migrations (production)
migrate:
	npm run migrate --workspace=backend

## Run DB migrations (dev, with prompts)
migrate-dev:
	npm run migrate:dev --workspace=backend

## Open Prisma Studio (DB GUI)
db-studio:
	npm run db:studio --workspace=backend

## Start backend in dev mode
dev-backend:
	npm run dev:backend

## Start frontend in dev mode
dev-frontend:
	npm run dev:frontend

## Start both (requires concurrently)
dev:
	npm run dev

## Build all
build:
	npm run build:backend && npm run build:frontend

## Run all tests
test:
	npm run test

## Start full Docker stack (prod)
up:
	docker-compose -f backend/docker/docker-compose.yml up --build -d

## Stop full Docker stack
down:
	docker-compose -f backend/docker/docker-compose.yml down

## View API logs
logs:
	docker-compose -f backend/docker/docker-compose.yml logs -f api
