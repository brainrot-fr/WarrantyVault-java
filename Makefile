.PHONY: local run test secret demo

-include .env

export MYSQL_USER
export MYSQL_PASSWORD
ifneq ($(origin APP_JWT_SECRET),undefined)
export APP_JWT_SECRET
endif
ifneq ($(origin APP_COOKIE_SECURE),undefined)
export APP_COOKIE_SECURE
endif
ifneq ($(origin APP_SEED_DEMO_DATA),undefined)
export APP_SEED_DEMO_DATA
endif
ifneq ($(origin APP_DEMO_PASSWORD),undefined)
export APP_DEMO_PASSWORD
endif

secret:
	@if ! grep -q '^APP_JWT_SECRET=.' .env 2>/dev/null; then printf 'APP_JWT_SECRET=%s\n' "$$(openssl rand -base64 48)" >> .env; fi

local: run

run: secret
	@if curl --silent --fail --max-time 2 http://127.0.0.1:8080/ | grep -q 'id="app"'; then \
		echo "WarrantyVault is already running at http://127.0.0.1:8080."; \
	else \
		cd server && APP_JWT_SECRET="$${APP_JWT_SECRET:-$$(sed -n 's/^APP_JWT_SECRET=//p' ../.env | tail -n 1)}" APP_COOKIE_SECURE="$${APP_COOKIE_SECURE:-false}" APP_SEED_DEMO_DATA="$${APP_SEED_DEMO_DATA:-false}" ./mvnw spring-boot:run; \
	fi

demo:
	@test -n "$$APP_DEMO_PASSWORD" || { echo "Set APP_DEMO_PASSWORD in .env before enabling demo data."; exit 1; }
	$(MAKE) run APP_SEED_DEMO_DATA=true

test:
	cd server && ./mvnw -B verify
