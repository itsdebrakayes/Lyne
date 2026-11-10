-- 046_holiday_closures.sql — national holidays close a branch by themselves.
--
-- public_holidays held the statutory date. A branch shuts on the day it is
-- OBSERVED, so that is what it now holds: Labour Day on a Saturday or Sunday moves
-- to the Monday, and other holidays on a Sunday move to the Monday. Years to 2030
-- are added; Easter-based dates are calculated, and any date the government
-- proclaims differently needs correcting here.
--
-- holiday_openings is the opposite of a closure: this branch (or, with branch_id
-- NULL, the whole organisation) chose to stay open on this holiday.

CREATE TABLE IF NOT EXISTS holiday_openings (
  id           CHAR(36)  NOT NULL,
  business_id  CHAR(36)  NOT NULL,
  branch_id    CHAR(36)  NULL,
  holiday_date DATE      NOT NULL,
  created_by   CHAR(36)  NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_opening_lookup (business_id, holiday_date, branch_id),
  CONSTRAINT fk_opening_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
  CONSTRAINT fk_opening_branch   FOREIGN KEY (branch_id)   REFERENCES branches (id)   ON DELETE CASCADE
);

UPDATE public_holidays SET holiday_date = '2026-05-25' WHERE country = 'JM' AND holiday_date = '2026-05-23';
UPDATE public_holidays SET holiday_date = '2027-05-24' WHERE country = 'JM' AND holiday_date = '2027-05-23';
UPDATE public_holidays SET holiday_date = '2027-08-02' WHERE country = 'JM' AND holiday_date = '2027-08-01';
UPDATE public_holidays SET holiday_date = '2027-12-27' WHERE country = 'JM' AND holiday_date = '2027-12-26';

INSERT IGNORE INTO public_holidays (holiday_date, country, name) VALUES
  ('2028-01-01','JM','New Year''s Day'), ('2028-03-01','JM','Ash Wednesday'), ('2028-04-14','JM','Good Friday'),
  ('2028-04-17','JM','Easter Monday'), ('2028-05-23','JM','Labour Day'), ('2028-08-01','JM','Emancipation Day'),
  ('2028-08-07','JM','Independence Day'), ('2028-10-16','JM','National Heroes'' Day'), ('2028-12-25','JM','Christmas Day'),
  ('2028-12-26','JM','Boxing Day'),
  ('2029-01-01','JM','New Year''s Day'), ('2029-02-14','JM','Ash Wednesday'), ('2029-03-30','JM','Good Friday'),
  ('2029-04-02','JM','Easter Monday'), ('2029-05-23','JM','Labour Day'), ('2029-08-01','JM','Emancipation Day'),
  ('2029-08-06','JM','Independence Day'), ('2029-10-15','JM','National Heroes'' Day'), ('2029-12-25','JM','Christmas Day'),
  ('2029-12-26','JM','Boxing Day'),
  ('2030-01-01','JM','New Year''s Day'), ('2030-03-06','JM','Ash Wednesday'), ('2030-04-19','JM','Good Friday'),
  ('2030-04-22','JM','Easter Monday'), ('2030-05-23','JM','Labour Day'), ('2030-08-01','JM','Emancipation Day'),
  ('2030-08-06','JM','Independence Day'), ('2030-10-21','JM','National Heroes'' Day'), ('2030-12-25','JM','Christmas Day'),
  ('2030-12-26','JM','Boxing Day');
