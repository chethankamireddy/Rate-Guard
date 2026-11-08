FROM gcc:13 AS builder

WORKDIR /app
COPY . .
RUN g++ -std=c++17 -O3 -pthread -Iinclude src/TokenBucket.cpp src/SlidingWindow.cpp src/main.cpp -o engine

FROM debian:bookworm-slim AS runner
WORKDIR /app
COPY --from=builder /app/engine /app/engine
EXPOSE 7070
CMD ["/app/engine", "7070"]
