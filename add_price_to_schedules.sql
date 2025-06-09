-- Add price column to schedules table
ALTER TABLE schedules ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;

-- Update any existing schedules to have a default price
-- You can run this if you want to set a default price for existing schedules
-- UPDATE schedules SET price = 0.00 WHERE price IS NULL;

-- Comment: This migration adds a price field to the schedules table
-- allowing tour creators to set specific prices for each scheduled tour session
