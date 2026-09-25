ALTER TABLE adjustments ADD COLUMN suggested_mesa_contracts TEXT;
ALTER TABLE adjustments ADD COLUMN suggested_real_lots TEXT;

UPDATE adjustments
SET suggested_mesa_contracts = CASE
      WHEN market = 'mesa' THEN suggested_quantity
      ELSE (SELECT CAST(mesa_contracts AS TEXT) FROM operations WHERE operations.id = adjustments.operation_id)
    END,
    suggested_real_lots = CASE
      WHEN market = 'real' THEN suggested_quantity
      ELSE (SELECT real_lots FROM operations WHERE operations.id = adjustments.operation_id)
    END;
