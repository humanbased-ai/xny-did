import { BigInt, Bytes, Entity, JSONValue } from '@graphprotocol/graph-ts';

export function uint128ToUUID(value: BigInt): string {
  // 定义 128 位最大值 (2^128 - 1)
  const UINT128_MAX = BigInt.fromString('340282366920938463463374607431768211455');

  // 边界检查
  if (value < BigInt.fromI32(0) || value > UINT128_MAX) {
    throw new Error('Value must be a 128-bit unsigned integer');
  }

  // 转换为十六进制字符串
  let hex = value.toHexString();

  // 移除 '0x' 前缀
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }

  // 填充到 32 个字符（128 位 = 32 个十六进制字符）
  const paddedHex = hex.padStart(32, '0');

  // 如果填充后超过 32 个字符，说明输入超过了 128 位
  if (paddedHex.length > 32) {
    throw new Error('Value exceeds 128 bits');
  }

  // 格式化为 UUID：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [
    paddedHex.substring(0, 8),
    paddedHex.substring(8, 12),
    paddedHex.substring(12, 16),
    paddedHex.substring(16, 20),
    paddedHex.substring(20, 32),
  ].join('-');
}

export function uint128ToDID(value: BigInt): string {
  return 'did:xny:' + uint128ToUUID(value);
}

export function isValidDID(did: string): boolean {
  // check prefix
  if (!did.startsWith('did:')) {
    return false;
  }

  // check parts
  const parts = did.split(':');

  // at least 3 parts
  if (parts.length < 3) {
    return false;
  }

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length == 0) {
      return false;
    }
  }

  return true;
}

export function isNumericString(s: string): boolean {
  let len = s.length;
  if (len == 0) return false;

  for (let i = 0; i < len; i++) {
    let c = s.charCodeAt(i);
    if (c < 48 || c > 57) {
      // '0' = 48, '9' = 57
      return false;
    }
  }
  return true;
}
