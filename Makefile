.PHONY: local backend frontend test clean-local

local:
	@set -eu; \
	./backend/mvnw -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=local > backend/local.log 2>&1 & backend_pid=$$!; \
	trap 'kill "$$backend_pid" 2>/dev/null || true; wait "$$backend_pid" 2>/dev/null || true' EXIT INT TERM; \
	cd frontend; \
	npm install; \
	npm run dev

backend:
	cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

frontend:
	cd frontend && npm install && npm run dev

test:
	cd backend && ./mvnw -B verify
	cd frontend && npm run lint && npm test && npm run build

clean-local:
	@if [ -d backend/data ] || [ -d backend/uploads ]; then \
		rm -rf backend/data backend/uploads; \
		printf 'Removed backend/data and backend/uploads\\n'; \
	else \
		printf 'No backend/data or backend/uploads directories to remove\\n'; \
	fi
