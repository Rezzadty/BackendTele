# Telegram Backend (Express.js)

This project uses Express.js with a clean architecture structure.
It is built to check Firebase data updates from the microcontroller and send notifications to Telegram.

## Project Structure

```text
src/
  domain/
    entities/
    repositories/
  application/
    use-cases/
  infrastructure/
    firebase/
    telegram/
  presentation/
    http/
      routes/
    workers/
  shared/
    config/
  main/
```

## Layer Overview

- domain: business rules and interfaces
- application: use cases and application logic
- infrastructure: Firebase and Telegram implementations
- presentation: Express.js routes and background workers
- main: app bootstrap and dependency wiring
