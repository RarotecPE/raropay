-- Adicionar nota fiscal à despesa #287
UPDATE expenses
SET 
  receipt_url = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-04-14%20at%2015.24.12-NwOsUP0drdv7AmrY263N5CvVNnD8Zu.jpeg',
  updated_at = NOW()
WHERE id = 287;
