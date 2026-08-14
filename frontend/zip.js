/**
 * 의존성 없는 최소 ZIP 읽기/쓰기.
 *
 * 백업에 첨부파일 실물이 들어가야 하므로(발주서 §16.3) 압축 컨테이너가 필요한데,
 * 이 프로젝트는 의존성을 최소로 유지한다(§18). WebView2/Chromium 에 있는
 * CompressionStream('deflate-raw') 로 표준 ZIP 을 직접 만든다.
 *
 * 쓰기: deflate 가 이득일 때만 압축하고 아니면 저장(method 0).
 * 읽기: method 0 과 8 을 모두 받는다 — 사용자가 탐색기에서 다시 압축한 파일도 열려야 한다.
 */
(function () {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function through(bytes, Stream, kind) {
    const s = new Stream(kind);
    const w = s.writable.getWriter();
    w.write(bytes);
    w.close();
    const parts = [];
    const r = s.readable.getReader();
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      parts.push(value);
    }
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const deflateRaw = (b) => through(b, CompressionStream, 'deflate-raw');
  const inflateRaw = (b) => through(b, DecompressionStream, 'deflate-raw');

  // ZIP 은 1980 기준 DOS 시각을 쓴다.
  function dosTime(d) {
    return { time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
             date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff };
  }

  /**
   * @param {{name:string, data:Uint8Array}[]} entries
   * @returns {Promise<Uint8Array>}
   */
  async function create(entries, when = new Date()) {
    const { time, date } = dosTime(when);
    const parts = [];
    const central = [];
    let offset = 0;

    for (const e of entries) {
      const name = enc.encode(e.name);
      const raw = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data);
      const crc = crc32(raw);
      let body = raw, method = 0;
      if (raw.length > 64) {
        const packed = await deflateRaw(raw);
        if (packed.length < raw.length) { body = packed; method = 8; }
      }

      const lfh = new Uint8Array(30);
      const lv = new DataView(lfh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);   // 파일명 UTF-8
      lv.setUint16(8, method, true);
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, body.length, true);
      lv.setUint32(22, raw.length, true);
      lv.setUint16(26, name.length, true);
      parts.push(lfh, name, body);

      const cdh = new Uint8Array(46);
      const cv = new DataView(cdh.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, method, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, body.length, true);
      cv.setUint32(24, raw.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      central.push(cdh, name);

      offset += lfh.length + name.length + body.length;
    }

    let cdSize = 0;
    for (const c of central) cdSize += c.length;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    let total = offset + cdSize + eocd.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of [...parts, ...central, eocd]) { out.set(p, at); at += p.length; }
    return out;
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<Map<string, Uint8Array>>}
   */
  async function read(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // EOCD 는 끝에서 뒤로 찾는다(주석이 붙어 있을 수 있다).
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP 형식이 아닙니다.');

    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const out = new Map();

    for (let n = 0; n < count; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 중앙 디렉터리가 손상됐습니다.');
      const method = v.getUint16(p + 10, true);
      const compSize = v.getUint32(p + 20, true);
      const rawSize = v.getUint32(p + 24, true);
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;

      if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`ZIP 항목이 손상됐습니다: ${name}`);
      const lNameLen = v.getUint16(local + 26, true);
      const lExtraLen = v.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtraLen;
      const body = bytes.subarray(start, start + compSize);

      if (name.endsWith('/')) continue; // 디렉터리 항목
      if (method === 0) out.set(name, body.slice());
      else if (method === 8) out.set(name, await inflateRaw(body));
      else throw new Error(`지원하지 않는 압축 방식(${method}): ${name}`);

      const got = out.get(name);
      if (got && got.length !== rawSize) throw new Error(`ZIP 항목 크기가 맞지 않습니다: ${name}`);
    }
    return out;
  }

  const supported = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  window.WorkZip = { create, read, crc32, supported };
})();
