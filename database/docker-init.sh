#!/bin/bash
#
# docker-init.sh — bring a brand-new database up to date, without a hand-written list.
#
# This replaces ~30 lines per compose file that mounted every migration
# individually into /docker-entrypoint-initdb.d. That list was maintained by
# hand, in TWO files, and it failed exactly the way hand-maintained lists fail:
# migration 029 was written, applied to the running databases by hand, and never
# added to either file. A fresh install would have come up missing a table and
# four columns, and the demo seed that uses them would have died on first boot.
#
# So the source of truth is now the directory itself. Add a migration, and it is
# mounted. There is nothing to remember.
#
# ORDERING is alphabetical, which is why migrations are zero-padded (001_, 029_).
# A migration named without that prefix will run in the wrong place — that is the
# one rule this script cannot enforce for you.
#
# Seeds run LAST and only when asked. Previously seed.sql was mounted at slot 20,
# so it ran BEFORE migrations 020-029 and inserted into tables that later
# migrations then altered. Running it after the schema is fully built is both
# safer and easier to reason about.
set -euo pipefail

SQL_DIR=/qme-sql
DB="${MYSQL_DATABASE:-qme_now}"

run() {
  echo "[qme-init] $(basename "$1")"
  # --force is deliberately NOT used: a migration that fails should stop the
  # build loudly, not leave a half-built database that looks fine until a
  # customer's first query.
  mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB" < "$1"
}

echo "[qme-init] schema"
run "$SQL_DIR/schema.sql"

echo "[qme-init] migrations"
shopt -s nullglob
for f in "$SQL_DIR"/migrations/*.sql; do
  run "$f"
done

# Demo seeds are opt-in. Production never sets this, which is what keeps a
# customer's first database empty and sellable (see the branch invariants).
if [ "${QME_LOAD_DEMO_SEEDS:-false}" = "true" ]; then
  echo "[qme-init] demo seeds"
  for name in seed.sql demo_active_seed.sql demo_credit_union_seed.sql demo_sector_seed.sql; do
    [ -f "$SQL_DIR/$name" ] && run "$SQL_DIR/$name"
  done
fi

echo "[qme-init] done"
