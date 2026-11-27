import { describe, expect, it } from 'vitest';
import {
  BackupRecoveryKeyRequiredError,
  InvalidBackupRecoveryKeyError,
  createRecoveryKey,
  decodeDriveBackup,
  encryptBackup,
  importRecoveryKey,
  validateLocalBackup,
  type LocalBackup,
} from '@/lib/drive-backup-crypto';

function makeBackup(): LocalBackup {
  return {
    appName: 'على قدي',
    version: '3.0',
    exportedAt: '2026-11-27T10:00:00.000Z',
    exportDate: '2026-11-27T10:00:00.000Z',
    data: {
      transactions: [
        {
          id: 1,
          type: 'expense',
          amount: 120.5,
          category: 'مواصلات',
          date: '2026-11-20',
          createdAt: 1,
        },
      ],
      categories: [],
      budgets: [],
      debts: [{ id: 1, personName: 'أحمد', totalAmount: 300, isCompleted: false, createdAt: 1 }],
      gam3eyat: [],
      savings: [],
      wallets: [{ id: 1, name: 'كاش', kind: 'cash', balance: 1500, createdAt: 1 }],
      savingsGoals: [],
      recurringTransactions: [],
    },
  };
}

describe('recovery keys', () => {
  it('creates distinct 16-byte base64url codes', async () => {
    const first = await createRecoveryKey();
    const second = await createRecoveryKey();
    expect(first.recoveryCode).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second.recoveryCode).not.toBe(first.recoveryCode);
  });

  it('imports a valid recovery code and rejects wrong-length codes', async () => {
    const { recoveryCode } = await createRecoveryKey();
    const key = await importRecoveryKey(recoveryCode);
    expect(key).toBeInstanceOf(CryptoKey);

    await expect(importRecoveryKey('short-code')).rejects.toThrow(InvalidBackupRecoveryKeyError);
  });
});

describe('encrypt / decrypt round trip', () => {
  it('decrypts its own ciphertext back to the original backup (Arabic content intact)', async () => {
    const { key } = await createRecoveryKey();
    const backup = makeBackup();

    const envelope = await encryptBackup(backup, key);
    expect(envelope.format).toBe('ala-qaddi-drive-backup');
    expect(envelope.algorithm).toBe('AES-GCM-128');
    expect(envelope.ciphertext).not.toContain('مواصلات');

    const decoded = await decodeDriveBackup(envelope, key);
    expect(decoded.encrypted).toBe(true);
    expect(decoded.backup.data.transactions).toEqual(backup.data.transactions);
    expect(decoded.backup.data.debts).toEqual(backup.data.debts);
    expect(decoded.backup.data.wallets).toEqual(backup.data.wallets);
  });

  it('fails decryption with a different key (wrong passphrase)', async () => {
    const { key } = await createRecoveryKey();
    const wrong = (await createRecoveryKey()).key;
    const envelope = await encryptBackup(makeBackup(), key);

    await expect(decodeDriveBackup(envelope, wrong)).rejects.toThrow(InvalidBackupRecoveryKeyError);
  });

  it('requires a key for encrypted envelopes', async () => {
    const { key } = await createRecoveryKey();
    const envelope = await encryptBackup(makeBackup(), key);

    await expect(decodeDriveBackup(envelope)).rejects.toThrow(BackupRecoveryKeyRequiredError);
  });
});

describe('malformed envelope validation', () => {
  it('rejects a corrupted JSON string payload', async () => {
    await expect(decodeDriveBackup('{not-json')).rejects.toThrow('تالف');
  });

  it('rejects an encrypted envelope with an unsupported algorithm or version', async () => {
    await expect(
      decodeDriveBackup(
        {
          appName: 'على قدي',
          format: 'ala-qaddi-drive-backup',
          formatVersion: 2,
          algorithm: 'AES-256-GCM',
          iv: 'aXZpdg',
          ciphertext: 'ZmFrZQ',
        },
        (await createRecoveryKey()).key,
      ),
    ).rejects.toThrow('غير مدعومة');

    await expect(
      decodeDriveBackup(
        {
          appName: 'على قدي',
          format: 'ala-qaddi-drive-backup',
          formatVersion: 99,
          algorithm: 'AES-GCM-128',
          iv: 'aXZpdg',
          ciphertext: 'ZmFrZQ',
        },
        (await createRecoveryKey()).key,
      ),
    ).rejects.toThrow('غير مدعومة');
  });

  it('rejects envelopes missing iv or ciphertext', async () => {
    await expect(
      decodeDriveBackup(
        {
          appName: 'على قدي',
          format: 'ala-qaddi-drive-backup',
          formatVersion: 2,
          algorithm: 'AES-GCM-128',
        },
        (await createRecoveryKey()).key,
      ),
    ).rejects.toThrow('غير مدعومة');
  });
});

describe('validateLocalBackup', () => {
  it('accepts a valid backup and fills absent tables with empty arrays', () => {
    const partial = { appName: 'على قدي', data: { transactions: [{ id: 1 }] } };
    const validated = validateLocalBackup(partial);
    expect(validated.version).toBe('legacy');
    expect(validated.data.transactions).toEqual([{ id: 1 }]);
    expect(validated.data.wallets).toEqual([]);
    expect(validated.exportedAt).toBeTruthy();
  });

  it('rejects backups from other apps or with malformed tables', () => {
    expect(() => validateLocalBackup({ appName: 'other-app', data: {} })).toThrow();
    expect(() => validateLocalBackup({ appName: 'على قدي', data: { wallets: 'nope' } })).toThrow();
    expect(() => validateLocalBackup('string')).toThrow();
    expect(() => validateLocalBackup(null)).toThrow();
  });
});
