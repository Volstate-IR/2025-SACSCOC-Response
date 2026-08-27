// Rewrites root-relative hrefs/srcs/CSS url()s (e.g. "/standards/5-4.html",
// "/_astro/foo.css") into paths relative to each output file's location, so
// the built site can be opened directly from disk (file://) instead of
// requiring a web server.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function walk(dir) {
	const files = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			files.push(...walk(full));
		} else {
			files.push(full);
		}
	}
	return files;
}

function toRelative(currentFile, absPath) {
	const target = join(distDir, decodeURIComponent(absPath));
	let rel = relative(dirname(currentFile), target).split("\\").join("/");
	if (!rel.startsWith(".")) rel = `./${rel}`;
	return rel;
}

// Matches root-relative paths in href/src attributes and CSS url(), while
// skipping protocol-relative ("//host/..."), external, and non-path values.
const ATTR_PATTERN = /(href|src)=(["'])(\/(?!\/)[^"'#?]*)((?:[#?][^"']*)?)\2/g;
const CSS_URL_PATTERN = /url\((["']?)(\/(?!\/)[^"')#?]*)((?:[#?][^"')]*)?)\1\)/g;

function fixHtml(file) {
	let content = readFileSync(file, "utf8");
	content = content.replace(ATTR_PATTERN, (match, attr, quote, path, suffix) => {
		return `${attr}=${quote}${toRelative(file, path)}${suffix}${quote}`;
	});
	writeFileSync(file, content);
}

function fixCss(file) {
	let content = readFileSync(file, "utf8");
	content = content.replace(CSS_URL_PATTERN, (match, quote, path, suffix) => {
		return `url(${quote}${toRelative(file, path)}${suffix}${quote})`;
	});
	writeFileSync(file, content);
}

for (const file of walk(distDir)) {
	const ext = extname(file);
	if (ext === ".html") fixHtml(file);
	else if (ext === ".css") fixCss(file);
}

console.log("Relativized links for file:// viewing.");
