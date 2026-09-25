import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db, migrate, getSettings } from './db.js';
import { calculateAdjustment, calculateFinancialReset, calculateOperation, combinedImpact, enrichAdjustmentSuggestions } from './calculations.js';

migrate();

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || 'desenvolvimento-apenas-troque-esta-chave';
const here = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const tokenFor = (user) => jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });

function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const data = credentialsSchema.extend({ name: z.string().trim().min(2).max(80) }).parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  try {
    const created = db.transaction(() => {
      const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(data.name, data.email.toLowerCase(), hash);
      const id = Number(result.lastInsertRowid);
      db.prepare('INSERT INTO instrument_settings (user_id) VALUES (?)').run(id);
      db.prepare('INSERT INTO broker_settings (user_id) VALUES (?)').run(id);
      return { id, name: data.name, email: data.email.toLowerCase() };
    })();
    res.status(201).json({ token: tokenFor(created), user: created });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = credentialsSchema.parse(req.body);
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email.toLowerCase());
  if (!row || !(await bcrypt.compare(data.password, row.password_hash))) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: tokenFor(user), user });
}));

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json({ user });
});

const operationSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(120),
  mesaContracts: z.coerce.number().int('Contratos MNQ devem ser inteiros.').min(0),
  realLots: z.union([z.string(), z.number()]).transform(String),
  takeTicks: z.coerce.number().int('Take deve usar ticks inteiros.').positive(),
  stopTicks: z.coerce.number().int('Stop deve usar ticks inteiros.').positive(),
  status: z.enum(['PLANEJADA', 'EM ANDAMENTO', 'AJUSTADA', 'META ATINGIDA', 'ENCERRADA']).default('PLANEJADA'),
});

function validateLot(lot, settings) {
  let value;
  try { value = new Decimal(lot); } catch { throw new z.ZodError([{ code: 'custom', path: ['realLots'], message: 'Lote Real inválido.' }]); }
  const step = new Decimal(settings.lotStep);
  if (value.lt(settings.minLot) || value.gt(settings.maxLot)) throw new z.ZodError([{ code: 'custom', path: ['realLots'], message: `Lote deve ficar entre ${settings.minLot} e ${settings.maxLot}.` }]);
  if (!value.div(step).isInteger()) throw new z.ZodError([{ code: 'custom', path: ['realLots'], message: `Lote deve respeitar o passo ${settings.lotStep}.` }]);
}

function operationFromRow(row) {
  return {
    id: row.id, description: row.description, mesaContracts: row.mesa_contracts,
    realLots: row.real_lots, takeTicks: row.take_ticks, stopTicks: row.stop_ticks,
    mesaTake: row.mesa_take, mesaStop: row.mesa_stop, realTake: row.real_take, realStop: row.real_stop,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    adjustmentCount: Number(row.adjustment_count || 0),
  };
}

app.get('/api/operations', auth, (req, res) => {
  const rows = db.prepare(`SELECT o.*, COUNT(a.id) adjustment_count FROM operations o
    LEFT JOIN adjustments a ON a.operation_id = o.id WHERE o.user_id = ? GROUP BY o.id ORDER BY o.id DESC`).all(req.userId);
  res.json(rows.map(operationFromRow));
});

app.get('/api/operations/:id', auth, (req, res) => {
  const row = db.prepare('SELECT *, 0 adjustment_count FROM operations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Operação não encontrada.' });
  res.json(operationFromRow(row));
});

app.post('/api/operations', auth, (req, res) => {
  const data = operationSchema.parse(req.body);
  const settings = getSettings(req.userId);
  validateLot(data.realLots, settings);
  const result = calculateOperation(data, settings);
  const info = db.prepare(`INSERT INTO operations
    (user_id, description, mesa_contracts, real_lots, take_ticks, stop_ticks, mesa_take, mesa_stop, real_take, real_stop, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.userId, data.description, data.mesaContracts, data.realLots,
      data.takeTicks, data.stopTicks, result.mesaTake, result.mesaStop, result.realTake, result.realStop, data.status);
  const row = db.prepare('SELECT *, 0 adjustment_count FROM operations WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(operationFromRow(row));
});

app.put('/api/operations/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM operations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Operação não encontrada.' });
  const data = operationSchema.parse(req.body);
  const settings = getSettings(req.userId);
  validateLot(data.realLots, settings);
  const result = calculateOperation(data, settings);
  db.prepare(`UPDATE operations SET description=?, mesa_contracts=?, real_lots=?, take_ticks=?, stop_ticks=?,
    mesa_take=?, mesa_stop=?, real_take=?, real_stop=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`)
    .run(data.description, data.mesaContracts, data.realLots, data.takeTicks, data.stopTicks,
      result.mesaTake, result.mesaStop, result.realTake, result.realStop, data.status, req.params.id, req.userId);
  const row = db.prepare('SELECT *, 0 adjustment_count FROM operations WHERE id = ?').get(req.params.id);
  res.json(operationFromRow(row));
});

app.delete('/api/operations/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM operations WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (!info.changes) return res.status(404).json({ error: 'Operação não encontrada.' });
  res.status(204).end();
});

app.post('/api/calculate', auth, (req, res) => {
  const data = operationSchema.omit({ description: true, status: true }).parse(req.body);
  const settings = getSettings(req.userId);
  validateLot(data.realLots, settings);
  res.json(calculateOperation(data, settings));
});

const adjustmentCalcSchema = z.object({
  market: z.enum(['mesa', 'real']), target: z.union([z.string(), z.number()]).transform(String),
  realized: z.union([z.string(), z.number()]).transform(String),
  mode: z.enum(['keep_ticks', 'keep_quantity', 'suggest']),
  ticks: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  targetField: z.enum(['mesaTake', 'mesaStop', 'realTake', 'realStop']).optional(),
  referenceTakeTicks: z.coerce.number().int().positive().optional(),
  referenceStopTicks: z.coerce.number().int().positive().optional(),
  mesaContracts: z.coerce.number().int().min(0).optional(),
  realLots: z.union([z.string(), z.number()]).transform(String).optional(),
  operationId: z.coerce.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.mode === 'keep_ticks' && !data.ticks) ctx.addIssue({ code: 'custom', path: ['ticks'], message: 'Informe os ticks.' });
  if (data.mode === 'keep_quantity' && !data.quantity) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Informe a quantidade.' });
  if (data.market === 'mesa' && data.mode === 'keep_quantity' && !Number.isInteger(data.quantity)) {
    ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Contratos MNQ devem ser inteiros.' });
  }
});

app.post('/api/calculate-adjustment', auth, (req, res) => {
  const data = adjustmentCalcSchema.parse(req.body);
  const settings = getSettings(req.userId);
  if (!data.operationId) return res.json(enrichAdjustmentSuggestions(calculateAdjustment(data, settings), data, settings));
  const operation = db.prepare('SELECT * FROM operations WHERE id = ? AND user_id = ?').get(data.operationId, req.userId);
  if (!operation) return res.status(404).json({ error: 'Operação não encontrada.' });
  const previousAccumulated = db.prepare('SELECT realized_value FROM adjustments WHERE operation_id = ? AND user_id = ? AND market = ? ORDER BY id')
    .all(operation.id, req.userId, data.market).reduce((sum, row) => sum.plus(row.realized_value), new Decimal(0));
  const resultAccumulated = previousAccumulated.plus(data.realized);
  const metaTake = data.market === 'mesa' ? operation.mesa_take : operation.real_take;
  const metaStop = data.market === 'mesa' ? operation.mesa_stop : operation.real_stop;
  const target = data.targetField?.toLowerCase().includes('stop') ? metaStop : metaTake;
  const calculationInput = {
    ...data, target, realized: resultAccumulated.toFixed(2), previousAccumulated: previousAccumulated.toFixed(2),
    resultAccumulated: resultAccumulated.toFixed(2), metaTake, metaStop,
    mesaContracts: operation.mesa_contracts, realLots: operation.real_lots,
  };
  res.json(enrichAdjustmentSuggestions(calculateAdjustment(calculationInput, settings), calculationInput, settings));
});

app.post('/api/calculate-combined', auth, (req, res) => {
  const data = operationSchema.omit({ description: true, status: true }).extend({
    before: z.object({ mesaTake: z.any(), mesaStop: z.any(), realTake: z.any(), realStop: z.any() }).optional(),
  }).parse(req.body);
  const settings = getSettings(req.userId);
  validateLot(data.realLots, settings);
  res.json(combinedImpact(data, settings));
});

function adjustmentFromRow(row) {
  return {
    id: row.id, operationId: row.operation_id, targetField: row.target_field, targetValue: row.target_value,
    realizedValue: row.realized_value, balance: row.balance, market: row.market, mode: row.mode,
    suggestedQuantity: row.suggested_quantity, suggestedTicks: row.suggested_ticks,
    suggestedMesaContracts: row.suggested_mesa_contracts, suggestedRealLots: row.suggested_real_lots,
    suggestedTakeTicks: row.suggested_take_ticks, suggestedStopTicks: row.suggested_stop_ticks,
    predictedResult: row.predicted_result, difference: row.difference, notes: row.notes, createdAt: row.created_at,
    resultAccumulated: row.result_accumulated, metaTake: row.meta_take_value, metaStop: row.meta_stop_value,
    takeNeeded: row.take_needed, stopNeeded: row.stop_needed, takeResult: row.take_result, stopResult: row.stop_result,
    finalTake: row.final_take, finalStop: row.final_stop, takeDifference: row.take_difference, stopDifference: row.stop_difference,
  };
}

function adjustmentHistory(operation, rows, settings) {
  const running = { mesa: new Decimal(0), real: new Decimal(0) };
  return rows.map((row) => {
    running[row.market] = running[row.market].plus(row.realized_value);
    const metaTake = row.market === 'mesa' ? operation.mesa_take : operation.real_take;
    const metaStop = row.market === 'mesa' ? operation.mesa_stop : operation.real_stop;
    const calculated = calculateFinancialReset({
      metaTake, metaStop, resultAccumulated: running[row.market], market: row.market, quantity: row.suggested_quantity,
    }, settings);
    const stored = adjustmentFromRow(row);
    const hasResetSnapshot = row.result_accumulated !== null && row.result_accumulated !== undefined;
    const reset = hasResetSnapshot ? stored : calculated;
    const takeTarget = row.target_field.toLowerCase().includes('take');
    return {
      ...stored, ...reset,
      balance: takeTarget ? reset.takeNeeded : reset.stopNeeded,
      predictedResult: takeTarget ? reset.takeResult : reset.stopResult,
      difference: takeTarget ? reset.takeDifference : reset.stopDifference,
      suggestedTakeTicks: reset.takeTicks ?? row.suggested_take_ticks,
      suggestedStopTicks: reset.stopTicks ?? row.suggested_stop_ticks,
    };
  }).reverse();
}

app.get('/api/operations/:id/adjustments', auth, (req, res) => {
  const operation = db.prepare('SELECT * FROM operations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!operation) return res.status(404).json({ error: 'Operação não encontrada.' });
  const rows = db.prepare('SELECT * FROM adjustments WHERE operation_id = ? AND user_id = ? ORDER BY id').all(req.params.id, req.userId);
  res.json(adjustmentHistory(operation, rows, getSettings(req.userId)));
});

const saveAdjustmentSchema = z.object({
  targetField: z.enum(['mesaTake', 'mesaStop', 'realTake', 'realStop']),
  targetValue: z.union([z.string(), z.number()]).transform(String),
  realizedValue: z.union([z.string(), z.number()]).transform(String),
  market: z.enum(['mesa', 'real']), mode: z.enum(['keep_ticks', 'keep_quantity', 'suggest']),
  suggestedQuantity: z.union([z.string(), z.number()]).transform(String),
  suggestedTicks: z.coerce.number().int().positive(),
  predictedResult: z.union([z.string(), z.number()]).transform(String).optional(),
  difference: z.union([z.string(), z.number()]).transform(String).optional(), notes: z.string().max(300).optional().default(''),
});

app.post('/api/operations/:id/adjustments', auth, (req, res) => {
  const operation = db.prepare('SELECT * FROM operations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!operation) return res.status(404).json({ error: 'Operação não encontrada.' });
  const data = saveAdjustmentSchema.parse(req.body);
  const expectedTarget = operation[data.targetField.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
  if (!new Decimal(data.targetValue).eq(expectedTarget)) return res.status(400).json({ error: 'A meta informada não corresponde à operação original.' });
  const settings = getSettings(req.userId);
  const suggestedQuantity = new Decimal(data.suggestedQuantity);
  if (data.market === 'mesa' && (!suggestedQuantity.isInteger() || suggestedQuantity.lessThan(1))) {
    return res.status(400).json({ error: 'Contratos MNQ devem ser inteiros e positivos.' });
  }
  if (data.market === 'real') validateLot(data.suggestedQuantity, settings);
  const previousAccumulated = db.prepare('SELECT realized_value FROM adjustments WHERE operation_id = ? AND user_id = ? AND market = ? ORDER BY id')
    .all(operation.id, req.userId, data.market).reduce((sum, row) => sum.plus(row.realized_value), new Decimal(0));
  const resultAccumulated = previousAccumulated.plus(data.realizedValue);
  const metaTake = data.market === 'mesa' ? operation.mesa_take : operation.real_take;
  const metaStop = data.market === 'mesa' ? operation.mesa_stop : operation.real_stop;
  const reset = calculateFinancialReset({ metaTake, metaStop, resultAccumulated, market: data.market, quantity: data.suggestedQuantity }, settings);
  const takeTarget = data.targetField.toLowerCase().includes('take');
  const balance = takeTarget ? reset.takeNeeded : reset.stopNeeded;
  const predictedResult = takeTarget ? reset.takeResult : reset.stopResult;
  const difference = takeTarget ? reset.takeDifference : reset.stopDifference;
  const suggestedMesaContracts = data.market === 'mesa' ? data.suggestedQuantity : String(operation.mesa_contracts);
  const suggestedRealLots = data.market === 'real' ? data.suggestedQuantity : operation.real_lots;
  const suggestedTakeTicks = reset.takeTicks;
  const suggestedStopTicks = reset.stopTicks;
  const info = db.transaction(() => {
    const created = db.prepare(`INSERT INTO adjustments (operation_id,user_id,target_field,target_value,realized_value,balance,market,mode,
      suggested_quantity,suggested_ticks,predicted_result,difference,notes,suggested_mesa_contracts,suggested_real_lots,
      suggested_take_ticks,suggested_stop_ticks,result_accumulated,meta_take_value,meta_stop_value,take_needed,stop_needed,
      take_result,stop_result,final_take,final_stop,take_difference,stop_difference) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.params.id, req.userId, data.targetField, data.targetValue, data.realizedValue, balance, data.market, data.mode,
        data.suggestedQuantity, data.suggestedTicks, predictedResult, difference, data.notes, suggestedMesaContracts, suggestedRealLots,
        suggestedTakeTicks, suggestedStopTicks, reset.resultAccumulated, reset.metaTake, reset.metaStop, reset.takeNeeded, reset.stopNeeded,
        reset.takeResult, reset.stopResult, reset.finalTake, reset.finalStop, reset.takeDifference, reset.stopDifference);
    db.prepare("UPDATE operations SET status='AJUSTADA', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
    return created;
  })();
  res.status(201).json(adjustmentFromRow(db.prepare('SELECT * FROM adjustments WHERE id = ?').get(info.lastInsertRowid)));
});

app.get('/api/settings', auth, (req, res) => res.json(getSettings(req.userId)));

const settingsSchema = z.object({
  mnqTickSize: z.coerce.number().positive(), mnqTickValue: z.coerce.number().positive(),
  ustecValuePerPoint: z.coerce.number().positive(), lotStep: z.coerce.number().positive(),
  minLot: z.coerce.number().positive(), maxLot: z.coerce.number().positive(),
  locale: z.enum(['pt-BR', 'en-US']), currency: z.literal('USD'),
}).refine((data) => data.maxLot >= data.minLot, { path: ['maxLot'], message: 'O lote máximo deve ser maior que o mínimo.' });

app.put('/api/settings', auth, (req, res) => {
  const data = settingsSchema.parse(req.body);
  db.transaction(() => {
    db.prepare(`UPDATE instrument_settings SET mnq_tick_size=?, mnq_tick_value=?, ustec_value_per_point=? WHERE user_id=?`)
      .run(String(data.mnqTickSize), String(data.mnqTickValue), String(data.ustecValuePerPoint), req.userId);
    db.prepare(`UPDATE broker_settings SET lot_step=?, min_lot=?, max_lot=?, locale=?, currency=? WHERE user_id=?`)
      .run(String(data.lotStep), String(data.minLot), String(data.maxLot), data.locale, data.currency, req.userId);
  })();
  res.json(getSettings(req.userId));
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const clientDist = path.resolve(here, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(clientDist, 'index.html')));

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Dados inválidos.', details: error.flatten() });
  console.error(error);
  res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
});

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Ajuste de Lotes em http://localhost:${port}`));

export { app };
