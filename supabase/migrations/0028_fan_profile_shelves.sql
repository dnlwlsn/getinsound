-- Privacy columns
ALTER TABLE fan_profiles
  ADD COLUMN show_collection boolean NOT NULL DEFAULT true,
  ADD COLUMN show_wall boolean NOT NULL DEFAULT true;

-- Explicit follow relationship
CREATE TABLE fan_follows (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id  uuid REFERENCES artists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE fan_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fans can manage own follows"
  ON fan_follows FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read follows for public profiles"
  ON fan_follows FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fan_profiles
      WHERE id = fan_follows.user_id AND is_public = true
    )
  );

CREATE INDEX fan_follows_artist_idx ON fan_follows(artist_id);

-- Backfill: every fan auto-follows artists they've purchased from
INSERT INTO fan_follows (user_id, artist_id)
SELECT DISTINCT p.buyer_user_id, p.artist_id
FROM purchases p
WHERE p.status = 'paid'
ON CONFLICT DO NOTHING;
