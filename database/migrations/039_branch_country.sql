-- 039_branch_country.sql
--
-- The country each branch is in, so the app can stop recommending places in
-- another country. Jamaica and Cuba are closer to each other than Negril is
-- to Morant Point, so distance alone cannot tell them apart; the country can.
--
-- Every branch before this migration is Jamaican, so the default is 'JM'.
-- ISO 3166-1 alpha-2. Contains no organisation data; safe on production.

ALTER TABLE branches
  ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT 'JM' AFTER parish;
