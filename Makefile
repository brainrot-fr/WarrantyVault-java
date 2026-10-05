.PHONY: local run test

JAVA21_HOME ?= /usr/lib/jvm/java-21-openjdk

local run test: export JAVA_HOME := $(JAVA21_HOME)
local run test: export PATH := $(JAVA21_HOME)/bin:$(PATH)

local run:
	cd server && ./mvnw spring-boot:run -e & firefox http://localhost:8080/

test:
	cd server && ./mvnw -B verify
