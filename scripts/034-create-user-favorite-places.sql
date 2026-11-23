-- Endereços favoritos por usuário (atalhos estilo Waze no campo de busca de localização)
CREATE TABLE IF NOT EXISTS user_favorite_places (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_key VARCHAR(255) NOT NULL,
  alias VARCHAR(80) NULL,
  name VARCHAR(255) NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city VARCHAR(120) NOT NULL DEFAULT '',
  state VARCHAR(10) NOT NULL DEFAULT '',
  type VARCHAR(60) NOT NULL DEFAULT 'place',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, place_key)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_places_user_id
  ON user_favorite_places (user_id);
