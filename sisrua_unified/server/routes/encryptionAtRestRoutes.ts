/**
 * encryptionAtRestRoutes.ts — Rotas Encryption at Rest (75 [T1])
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  EncryptionAtRestService,
  EncryptedPayload,
} from "../services/encryptionAtRestService.js";

const router = Router();

const RegisterKeySchema = z.object({
  customerId: z.string().min(1),
  keyMaterialB64: z.string().min(1),
});

const RotateKeySchema = z.object({
  keyMaterialB64: z.string().min(1),
});

const EncryptSchema = z.object({
  customerId: z.string().min(1),
  plaintext: z.string().min(1),
  aadB64: z.string().optional(),
});

const DecryptSchema = z.object({
  payload: z.object({
    customerId: z.string().min(1),
    keyId: z.string().min(1),
    algorithm: z.literal("aes-256-gcm"),
    ivB64: z.string().min(1),
    authTagB64: z.string().min(1),
    ciphertextB64: z.string().min(1),
    aadB64: z.string().nullable(),
    encryptedAt: z.string().min(1),
  }),
});

router.post("/master-keys/register", (req: Request, res: Response) => {
  const parsed = RegisterKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  try {
    const result = EncryptionAtRestService.registerMasterKey(
      parsed.data.customerId,
      parsed.data.keyMaterialB64,
    );
    return res.status(201).json(result);
  } catch (err: unknown) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-keys/:customerId/rotate", (req: Request, res: Response) => {
  const parsed = RotateKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  try {
    const result = EncryptionAtRestService.rotateMasterKey(
      req.params["customerId"]!,
      parsed.data.keyMaterialB64,
    );
    return res.status(201).json(result);
  } catch (err: unknown) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-keys/:customerId", (req: Request, res: Response) => {
  return res.json(EncryptionAtRestService.listKeys(req.params["customerId"]!));
});

router.post("/encrypt", (req: Request, res: Response) => {
  const parsed = EncryptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  try {
    const encrypted = EncryptionAtRestService.encrypt(
      parsed.data.customerId,
      parsed.data.plaintext,
      parsed.data.aadB64,
    );
    return res.status(201).json(encrypted);
  } catch (err: unknown) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/decrypt", (req: Request, res: Response) => {
  const parsed = DecryptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  try {
    const plaintext = EncryptionAtRestService.decrypt(parsed.data.payload as EncryptedPayload);
    return res.json({ plaintext });
  } catch (err: unknown) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
