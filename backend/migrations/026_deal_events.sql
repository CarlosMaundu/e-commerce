-- 026_deal_events.sql — views and clicks on storefront deals (the top strip
-- and the home banner), for the Promotions report. A view counts once per
-- visitor, deal, placement and day; every click is kept.
CREATE TABLE promotion_events (
  id            BIGSERIAL PRIMARY KEY,
  promotion_id  INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('view', 'click')),
  placement     VARCHAR(10) NOT NULL CHECK (placement IN ('strip', 'banner')),
  visitor       VARCHAR(64) NOT NULL,                 -- hashed IP + browser
  user_id       INT,
  day           DATE NOT NULL,                        -- Nairobi date
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX promotion_events_one_view ON promotion_events (promotion_id, placement, visitor, day) WHERE kind = 'view';
CREATE INDEX promotion_events_promo ON promotion_events (promotion_id, kind, day);
