import { sql } from "@/lib/db"

// Lê uma configuração da tabela app_settings. Retorna null se não existir.
export async function getSetting(key: string): Promise<string | null> {
  const rows = (await sql`SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`) as { value: string | null }[]
  return rows[0]?.value ?? null
}

// Lê uma configuração booleana (armazenada como 'true'/'false').
export async function getBooleanSetting(key: string, fallback = false): Promise<boolean> {
  const value = await getSetting(key)
  if (value === null) return fallback
  return value === "true"
}

// Grava (upsert) uma configuração.
export async function setSetting(key: string, value: string, updatedBy?: number): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${value}, ${updatedBy ?? null}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
  `
}
