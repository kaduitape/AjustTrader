ALTER TABLE adjustments ADD COLUMN suggested_take_ticks INTEGER;
ALTER TABLE adjustments ADD COLUMN suggested_stop_ticks INTEGER;

UPDATE adjustments
SET suggested_take_ticks = CASE
      WHEN target_field IN ('mesaTake', 'realTake') THEN suggested_ticks
      ELSE MAX(1, CAST(ROUND(suggested_ticks * (SELECT take_ticks FROM operations WHERE operations.id = adjustments.operation_id) * 1.0 /
        (SELECT stop_ticks FROM operations WHERE operations.id = adjustments.operation_id)) AS INTEGER))
    END,
    suggested_stop_ticks = CASE
      WHEN target_field IN ('mesaStop', 'realStop') THEN suggested_ticks
      ELSE MAX(1, CAST(ROUND(suggested_ticks * (SELECT stop_ticks FROM operations WHERE operations.id = adjustments.operation_id) * 1.0 /
        (SELECT take_ticks FROM operations WHERE operations.id = adjustments.operation_id)) AS INTEGER))
    END;
