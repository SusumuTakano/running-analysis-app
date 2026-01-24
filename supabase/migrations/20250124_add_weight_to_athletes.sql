-- Add weight_kg column to athletes table for H-FVP calculations
ALTER TABLE athletes
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);

-- Add comment to explain the column
COMMENT ON COLUMN athletes.weight_kg IS '体重（kg）- H-FVP計算に使用';

-- Add check constraint for reasonable weight values (10-200 kg)
ALTER TABLE athletes
ADD CONSTRAINT athletes_weight_kg_check 
CHECK (weight_kg IS NULL OR (weight_kg >= 10 AND weight_kg <= 200));
