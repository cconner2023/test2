// Multi-symbol Data Matrix: split → parse → collect (any order) → reassemble
import { describe, it, expect } from 'vitest';
import {
    splitEnvelope,
    splitPlaintext,
    parseBarcodePart,
    scannedSymbolBytes,
    BarcodePartCollector,
    PART_SINGLE_MAX,
    PART_DATA_MAX,
    PART_HEADER_BYTES,
    MAX_PARTS,
} from '../barcodeParts';

function randomBytes(n: number, seed = 1): Uint8Array {
    const out = new Uint8Array(n);
    let x = seed;
    for (let i = 0; i < n; i++) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        out[i] = x & 0xff;
    }
    return out;
}

function latin1(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
}

function shuffle<T>(arr: T[], seed = 7): T[] {
    const a = [...arr];
    let x = seed;
    for (let i = a.length - 1; i > 0; i--) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const j = x % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

describe('splitEnvelope', () => {
    it('leaves short envelopes as one header-less legacy symbol', () => {
        const env = randomBytes(PART_SINGLE_MAX);
        const parts = splitEnvelope(env);
        expect(parts).toHaveLength(1);
        expect(parts[0]).toBe(env);
    });

    it('splits long envelopes into ~500B parts', () => {
        const parts = splitEnvelope(randomBytes(1400));
        expect(parts).toHaveLength(3);
        for (const p of parts) expect(p.length - PART_HEADER_BYTES).toBeLessThanOrEqual(500);
    });

    it('caps at 25 parts and grows part size', () => {
        const parts = splitEnvelope(randomBytes(20000));
        expect(parts).toHaveLength(MAX_PARTS);
        for (const p of parts) expect(p.length - PART_HEADER_BYTES).toBeLessThanOrEqual(PART_DATA_MAX);
    });

    it('throws beyond 16 maximum-size symbols', () => {
        expect(() => splitEnvelope(randomBytes(MAX_PARTS * PART_DATA_MAX + 1))).toThrow();
    });
});

describe('round-trip', () => {
    for (const len of [601, 1555, 4000, 9001, MAX_PARTS * PART_DATA_MAX]) {
        it(`reassembles ${len}B scanned in any order with duplicates`, () => {
            const env = randomBytes(len, len);
            const parts = splitEnvelope(env);
            const c = new BarcodePartCollector();
            const scans = shuffle([...parts, parts[0], parts[parts.length - 1]]);
            for (const bytes of scans) {
                // Camera path: ISO-8859-1 text → bytes
                const part = parseBarcodePart(scannedSymbolBytes(latin1(bytes)));
                expect(part).not.toBeNull();
                c.add(part!);
            }
            expect(c.isComplete).toBe(true);
            expect(c.total).toBe(parts.length);
            expect(c.assemble()).toEqual(env);
        });
    }
});

describe('collector', () => {
    it('rejects parts from a different set until reset', () => {
        const a = splitEnvelope(randomBytes(1400, 1)).map(b => parseBarcodePart(b)!);
        const b = splitEnvelope(randomBytes(1400, 2)).map(b => parseBarcodePart(b)!);
        const c = new BarcodePartCollector();
        expect(c.add(a[0])).toBe('new');
        expect(c.add(a[0])).toBe('duplicate');
        expect(c.add(b[1])).toBe('other-set');
        expect(c.count).toBe(1);
        expect(() => c.assemble()).toThrow();
        c.reset();
        expect(c.add(b[1])).toBe('new');
        expect(c.received).toEqual([1]);
    });
});

describe('parseBarcodePart', () => {
    it('rejects corrupted headers', () => {
        const part = splitEnvelope(randomBytes(1400))[1].slice();
        part[5] ^= 0x01;
        expect(parseBarcodePart(part)).toBeNull();
    });

    it('rarely mistakes legacy envelopes for parts', () => {
        let hits = 0;
        for (let i = 0; i < 20000; i++) {
            const env = randomBytes(200, i + 1);
            env[0] = 0xd1; // worst case: magic byte matches
            if (parseBarcodePart(env)) hits++;
        }
        // CRC-8 + index/total constraint: ~2e-5 even with the magic forced
        expect(hits).toBeLessThan(5);
    });

    it('ignores text-mode symbols', () => {
        expect(scannedSymbolBytes('enc:AAAA')).toBeNull();
        expect(scannedSymbolBytes('A1|plain|ascii')).toBeNull();
    });
});

describe('plaintext series', () => {
    it('leaves short plaintext as one legacy symbol', () => {
        expect(splitPlaintext('A1|' + 'x'.repeat(500))).toBeNull();
    });

    it('round-trips long plaintext in any order', () => {
        const text = 'A1|' + Array.from({ length: 300 }, (_, i) => `field${i}`).join('|');
        const parts = splitPlaintext(text)!;
        expect(parts.length).toBeGreaterThan(1);
        const c = new BarcodePartCollector();
        for (const bytes of shuffle(parts)) {
            const part = parseBarcodePart(scannedSymbolBytes(latin1(bytes)))!;
            expect(part.plain).toBe(true);
            c.add(part);
        }
        expect(c.isComplete).toBe(true);
        expect(c.plain).toBe(true);
        expect(new TextDecoder().decode(c.assemble())).toBe(text);
    });

    it('keeps plaintext and envelope sets apart', () => {
        const plain = parseBarcodePart(splitPlaintext('B2|' + 'y'.repeat(1400))![0])!;
        const env = parseBarcodePart(splitEnvelope(randomBytes(1400))[1])!;
        const c = new BarcodePartCollector();
        c.add(plain);
        expect(c.add(env)).toBe('other-set');
    });
});
