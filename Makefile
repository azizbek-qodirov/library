.PHONY: run stop

# Variables to hold PIDs
PIDS =

run:
	@echo "Starting services..."
	@trap '$(MAKE) stop' INT TERM EXIT; \
	( cd backend/library-service && make run ) & \
	 LIB_PID=$$!; \
	( cd backend/api-gateway && make run ) & \
	 API_PID=$$!; \
	( cd frontend && npm run dev ) & \
	 FRONT_PID=$$!; \
	 PIDS="$$LIB_PID $$API_PID $$FRONT_PID"; \
	 wait

stop:
	@echo "Stopping services..."
	@kill -TERM $$(jobs -p) 2>/dev/null || true
