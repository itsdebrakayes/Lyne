-- =============================================================
-- LYNE — Migration 013: Public holiday calendar
-- Government-agency queues (TAJ, NHT, PICA) spike hard around public
-- holidays and the surrounding days. Until now `is_holiday` was hardcoded
-- to 0 everywhere (export_csv.py, analytics.js), so the wait-time model
-- carried a dead feature and the demand forecast had no way to anticipate
-- a holiday surge. This table is the single source of truth for holidays,
-- consumed by the analytics export and the forecasting models.
--
-- Seeded with Jamaica national public holidays 2025–2027. Movable feasts
-- (Ash Wednesday, Good Friday, Easter Monday) and National Heroes' Day
-- (3rd Monday in October) are pre-computed per year.
-- =============================================================

USE qme_now;

CREATE TABLE IF NOT EXISTS public_holidays (
    holiday_date  DATE         NOT NULL,
    country       CHAR(2)      NOT NULL DEFAULT 'JM',
    name          VARCHAR(100) NOT NULL,
    is_full_day   BOOLEAN      NOT NULL DEFAULT TRUE,   -- half-days (rare) can be weighted differently
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (country, holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO public_holidays (holiday_date, country, name) VALUES
-- 2025
('2025-01-01','JM','New Year''s Day'),
('2025-03-05','JM','Ash Wednesday'),
('2025-04-18','JM','Good Friday'),
('2025-04-21','JM','Easter Monday'),
('2025-05-23','JM','Labour Day'),
('2025-08-01','JM','Emancipation Day'),
('2025-08-06','JM','Independence Day'),
('2025-10-20','JM','National Heroes'' Day'),
('2025-12-25','JM','Christmas Day'),
('2025-12-26','JM','Boxing Day'),
-- 2026
('2026-01-01','JM','New Year''s Day'),
('2026-02-18','JM','Ash Wednesday'),
('2026-04-03','JM','Good Friday'),
('2026-04-06','JM','Easter Monday'),
('2026-05-23','JM','Labour Day'),
('2026-08-01','JM','Emancipation Day'),
('2026-08-06','JM','Independence Day'),
('2026-10-19','JM','National Heroes'' Day'),
('2026-12-25','JM','Christmas Day'),
('2026-12-26','JM','Boxing Day'),
-- 2027
('2027-01-01','JM','New Year''s Day'),
('2027-02-10','JM','Ash Wednesday'),
('2027-03-26','JM','Good Friday'),
('2027-03-29','JM','Easter Monday'),
('2027-05-23','JM','Labour Day'),
('2027-08-01','JM','Emancipation Day'),
('2027-08-06','JM','Independence Day'),
('2027-10-18','JM','National Heroes'' Day'),
('2027-12-25','JM','Christmas Day'),
('2027-12-26','JM','Boxing Day');
