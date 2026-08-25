-- Screenshots on agent-submitted findings.
-- `shots` = JSON array of { url, caption } (supports before → after pairs).
-- Stored as a URL list; the images themselves live in R2 (bucket bugledger-shots),
-- served publicly via GET /api/shot/:key. Append-only integrity is unchanged —
-- shots are written once at INSERT time, never updated.
ALTER TABLE submitted ADD COLUMN shots TEXT;
