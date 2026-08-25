-- evidence-weighted coverage: record HOW the covered ground was verified, not just that it was listed.
-- cov_verified = count of matched catalog items whose evidence is detector | code-read | test.
-- evidence     = JSON {detector, code-read, test, reasoned, assumed} tally over matched items.
-- Additive ADD COLUMN only — safe on the live table; old rows keep NULL and read as "unknown".
ALTER TABLE checks ADD COLUMN cov_verified INTEGER;
ALTER TABLE checks ADD COLUMN evidence TEXT;
