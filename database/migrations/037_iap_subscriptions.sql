-- 037_iap_subscriptions.sql
--
-- Lyne Premium bought through Apple In-App Purchase or Google Play Billing.
--
-- One row per store subscription: Apple's originalTransactionId, or Google's
-- purchase token. store_ref is UNIQUE so one store subscription can unlock
-- exactly one Lyne account; a second account presenting the same purchase is
-- refused rather than quietly sharing it. users.premium_until is what the app
-- reads; this table is the record of where it came from.

CREATE TABLE IF NOT EXISTS iap_subscriptions (
    id           CHAR(36)     NOT NULL,
    user_id      CHAR(36)     NOT NULL,
    platform     ENUM('ios', 'android') NOT NULL,
    product_id   VARCHAR(120) NOT NULL,
    store_ref    VARCHAR(512) NOT NULL,
    expires_at   DATETIME     NOT NULL,
    environment  VARCHAR(20)  NOT NULL DEFAULT 'production',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_iap_store_ref (store_ref(255)),
    KEY idx_iap_user (user_id),
    CONSTRAINT fk_iap_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
