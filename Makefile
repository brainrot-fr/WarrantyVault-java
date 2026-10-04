.PHONY: local run test clean-local

local: run

run:
	cd server && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

test:
	cd server && ./mvnw -B verify

clean-local:
	@if [ -d server/data ] || [ -d server/uploads ]; then \
		rm -rf server/data server/uploads; \
		printf 'Removed server/data and server/uploads\\n'; \
	else \
		printf 'No server/data or server/uploads directories to remove\\n'; \
	fi
