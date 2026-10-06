// Inspect JPEG framing and dimensions before accepting a small public thumbnail.
export function validProfilePhoto(bytes) {
  if (
    bytes.length < 100 ||
    bytes.length > 32768 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    return false;
  let offset = 2,
    dimensions = false;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) return dimensions;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return false;
      const height = bytes.readUInt16BE(offset + 3),
        width = bytes.readUInt16BE(offset + 5);
      if (!height || !width || width > 512 || height > 512) return false;
      dimensions = true;
    }
    offset += length;
  }
  return false;
}
