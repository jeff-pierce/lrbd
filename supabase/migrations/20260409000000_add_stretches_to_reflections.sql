-- Add stretches column to reflections for daily "uncomfortable action" notes.
ALTER TABLE reflections
  ADD COLUMN IF NOT EXISTS stretches text;
