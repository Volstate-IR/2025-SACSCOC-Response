import { visit } from "unist-util-visit";

/** Derives a readable label from a filename when no title is given, e.g. "10_Catalog_Dropdown.pdf" -> "Catalog Dropdown". */
function labelFromHref(href) {
	const filename = href.split("/").pop() ?? href;
	const withoutExt = filename.replace(/\.[^.]+$/, "");
	const withoutPrefix = withoutExt.replace(/^\d+[_-]?/, "");
	return withoutPrefix.replace(/[_-]+/g, " ").trim() || filename;
}

function slugify(text) {
	return (
		text
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-") || "section"
	);
}

function textOf(node) {
	if (node.type === "text") return node.value;
	return (node.children ?? []).map(textOf).join("");
}

/**
 * Groups the tree's top-level nodes into `<section data-block="…">` blocks,
 * one per h2, so each part of a standard's response (Committee Findings,
 * Response Narrative, Evidence/Supporting Documentation) can be styled
 * distinctly and jumped to directly. Also prepends a pill nav linking to
 * each section when a page has more than one.
 */
function wrapSections(tree) {
	const children = tree.children;
	const groups = [];
	let current = null;

	for (const node of children) {
		if (node.type === "element" && node.tagName === "h2") {
			const slug = slugify(textOf(node));
			node.properties = { ...node.properties, id: slug };
			current = { slug, label: textOf(node), nodes: [node] };
			groups.push(current);
		} else if (current) {
			current.nodes.push(node);
		} else {
			// Content before the first h2 (e.g. a placeholder blockquote) stays
			// at the top level, ungrouped.
			groups.push({ slug: null, label: null, nodes: [node] });
		}
	}

	tree.children = groups.map((group) => {
		if (!group.slug) return group.nodes[0];
		return {
			type: "element",
			tagName: "section",
			properties: { className: ["block"], "data-block": group.slug },
			children: group.nodes,
		};
	});

	const jumpTargets = groups.filter((g) => g.slug);
	if (jumpTargets.length > 1) {
		tree.children.unshift({
			type: "element",
			tagName: "nav",
			properties: { className: ["section-jump-nav"], "aria-label": "Jump to section" },
			children: [
				{
					type: "element",
					tagName: "span",
					properties: { className: ["section-jump-label"] },
					children: [{ type: "text", value: "Jump to:" }],
				},
				{
					type: "element",
					tagName: "ul",
					properties: { className: ["section-jump"] },
					children: jumpTargets.map(({ slug, label }) => ({
						type: "element",
						tagName: "li",
						properties: {},
						children: [
							{
								type: "element",
								tagName: "a",
								properties: { href: `#${slug}` },
								children: [{ type: "text", value: label }],
							},
						],
					})),
				},
			],
		});
	}
}

/** Returns a bare h2 + ol pair (not pre-wrapped) so wrapSections() groups it
 * into a data-block like any other markdown section. */
function buildIndexNodes(entries) {
	return [
		{ type: "element", tagName: "h2", properties: {}, children: [{ type: "text", value: "Supporting Documentation" }] },
		{
			type: "element",
			tagName: "ol",
			properties: {},
			children: entries.map(({ href, label }) => ({
				type: "element",
				tagName: "li",
				properties: {},
				children: [
					{
						type: "element",
						tagName: "a",
						properties: { href, target: "_blank", rel: "noopener noreferrer" },
						children: [{ type: "text", value: label }],
					},
				],
			})),
		},
	];
}

/**
 * Turns `[cite](url "label")` links into auto-numbered superscript links that
 * open the target directly in a new tab, e.g. <sup><a href="url" target="_blank">1</a></sup>,
 * and appends an "Evidence Index" listing every cited document at the bottom
 * of the page, in citation order. Numbering restarts per page, in order of
 * first appearance. Citing the same url more than once reuses its original
 * number rather than incrementing, and is not duplicated in the index. The
 * optional link title becomes the index label; without one, a label is
 * derived from the filename.
 *
 * Every other link with an href (e.g. plain links in a manually written
 * Evidence list) also gets target="_blank" so evidence never navigates away
 * from the response page, even when it isn't wired up as an inline citation.
 */
export default function rehypeCite(base = "") {
	const normalizedBase = base.replace(/\/+$/, "");

	/** Root-relative hrefs (e.g. "/documents/…") need the site's base path
	 * prepended so they resolve correctly when deployed under a subpath
	 * (e.g. GitHub Pages project sites). Absolute URLs, protocol-relative
	 * URLs, and fragments/mailto/tel links are left untouched. */
	function withBase(href) {
		if (!normalizedBase || !href.startsWith("/") || href.startsWith("//")) return href;
		return `${normalizedBase}${href}`;
	}

	return (tree) => {
		let counter = 0;
		const numberByHref = new Map();
		const entries = [];

		visit(tree, "element", (node, index, parent) => {
			if (!(parent && typeof index === "number" && node.tagName === "a" && node.properties?.href)) {
				return;
			}

			node.properties.href = withBase(node.properties.href);

			const isCite =
				node.children?.length === 1 &&
				node.children[0].type === "text" &&
				node.children[0].value.trim().toLowerCase() === "cite";

			if (!isCite) {
				node.properties = {
					...node.properties,
					target: "_blank",
					rel: "noopener noreferrer",
				};
				return;
			}

			const href = node.properties?.href;
			const label = node.properties?.title || labelFromHref(href);
			let number = numberByHref.get(href);
			if (number === undefined) {
				counter += 1;
				number = counter;
				numberByHref.set(href, number);
				entries.push({ href, label });
			}

			node.children[0].value = String(number);
			node.properties = {
				...node.properties,
				target: "_blank",
				rel: "noopener noreferrer",
				"aria-label": `Citation ${number}: ${label}`,
			};

			parent.children[index] = {
				type: "element",
				tagName: "sup",
				properties: { className: ["citation"] },
				children: [node],
			};
		});

		if (entries.length > 0) {
			tree.children.push(...buildIndexNodes(entries));
		}

		wrapSections(tree);
	};
}
