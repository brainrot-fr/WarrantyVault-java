.PHONY: local run test

local run:
	cd server && ./mvnw spring-boot:run -e & firefox http://localhost:8080/

test:
	cd server && ./mvnw -B verify
