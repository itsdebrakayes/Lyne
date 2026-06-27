# Q ME NOW Demo Branch

This branch is for demos and sales walkthroughs only. It keeps the production app code, plus demo seed SQL for sample businesses and queue activity.

Production deployments should use `main`.

## Demo Startup

Use the normal stack plus the demo overlay:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

The demo overlay loads:

- `database/seed.sql`
- `database/demo_data.sql`

Because MySQL only runs init scripts when the database volume is first created, reset the local demo database volume if you need to reload seed data:

```bash
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

Do not merge demo seed data back into production `main`.
