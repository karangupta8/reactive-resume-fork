// Inlined instead of importing from @uiw/color-convert: its named ESM exports fail to resolve under Node 22 + pnpm.
type Hsva = { h: number; s: number; v: number; a: number };

function hsvaToRgba(hsva: Hsva): { r: number; g: number; b: number; a: number } {
	const h = hsva.h / 360;
	const s = hsva.s / 100;
	const v = hsva.v / 100;
	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	let r = 0;
	let g = 0;
	let b = 0;
	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}
	return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: hsva.a };
}

function hsvaToHex(hsva: Hsva): string {
	const { r, g, b } = hsvaToRgba(hsva);
	return `#${toHexComponent(r)}${toHexComponent(g)}${toHexComponent(b)}`;
}

function rgbaStringToHsva(rgba: string): Hsva {
	const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(rgba);
	if (!match) return { h: 0, s: 0, v: 0, a: 1 };
	const r = Number.parseInt(match[1] ?? "0", 10) / 255;
	const g = Number.parseInt(match[2] ?? "0", 10) / 255;
	const b = Number.parseInt(match[3] ?? "0", 10) / 255;
	const a = match[4] ? Number.parseFloat(match[4]) : 1;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const v = max;
	const s = max === 0 ? 0 : d / max;
	let h = 0;
	if (max !== min) {
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;
	}
	return { h: h * 360, s: s * 100, v: v * 100, a };
}

type ParsedColor = { r: number; g: number; b: number; a: number };

export function rgbaStringToHex(rgba: string): string {
	const color = parseColorString(rgba);
	if (color) return `#${toHexComponent(color.r)}${toHexComponent(color.g)}${toHexComponent(color.b)}`;
	// Fallback: the local parser is integer-only, so percentage-notation rgb() (e.g. "rgb(100%,0%,0%)")
	// reaches here — @uiw converts it. Everything @uiw can't parse (named colors, hsl, transparent)
	// yields black, same as it always has. Custom style-rule colors are arbitrary strings, so keep this.
	return hsvaToHex(rgbaStringToHsva(rgba));
}

function toHexComponent(value: number): string {
	return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

export function parseColorString(value: string): ParsedColor | null {
	const trimmed = value.trim();

	// Parse rgb/rgba colors
	const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);

	if (rgbMatch) {
		return {
			r: Number.parseInt(rgbMatch[1] ?? "0", 10),
			g: Number.parseInt(rgbMatch[2] ?? "0", 10),
			b: Number.parseInt(rgbMatch[3] ?? "0", 10),
			a: rgbMatch[4] ? Number.parseFloat(rgbMatch[4]) : 1,
		};
	}

	// Parse hex colors (convert to RGB)
	if (trimmed.startsWith("#")) {
		const hexMatch = trimmed.match(/^#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i);
		if (hexMatch) {
			return {
				r: Number.parseInt(hexMatch[1] ?? "0", 16),
				g: Number.parseInt(hexMatch[2] ?? "0", 16),
				b: Number.parseInt(hexMatch[3] ?? "0", 16),
				a: 1,
			};
		}

		// Support 3-digit hex
		const hexMatch3 = trimmed.match(/^#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])$/i);
		if (hexMatch3) {
			return {
				r: Number.parseInt((hexMatch3[1] ?? "0") + (hexMatch3[1] ?? "0"), 16),
				g: Number.parseInt((hexMatch3[2] ?? "0") + (hexMatch3[2] ?? "0"), 16),
				b: Number.parseInt((hexMatch3[3] ?? "0") + (hexMatch3[3] ?? "0"), 16),
				a: 1,
			};
		}
	}

	return null;
}

/** Returns true if the given color string is perceptually dark (luminance < 128). */
export function isDarkColor(colorString: string): boolean {
	const color = parseColorString(colorString);
	if (!color) return false;
	const alpha = Math.max(0, Math.min(1, color.a ?? 1));
	const r = color.r * alpha + 255 * (1 - alpha);
	const g = color.g * alpha + 255 * (1 - alpha);
	const b = color.b * alpha + 255 * (1 - alpha);
	// Relative luminance (ITU-R BT.601)
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
	return luminance < 128;
}

// WCAG 2 relative luminance of an sRGB channel (0–255).
const linear = (channel: number) => {
	const value = channel / 255;
	return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** WCAG contrast of a colour against white, with any transparency laid over white first. 1 when it can't be read. */
export function contrastOnWhite(colorString: string): number {
	const color = parseColorString(colorString);
	if (!color) return 1;
	const alpha = Math.max(0, Math.min(1, color.a));
	const [r, g, b] = [color.r, color.g, color.b].map((channel) => linear(channel * alpha + 255 * (1 - alpha)));
	const luminance = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
	return 1.05 / (luminance + 0.05);
}
