import { visit } from "unist-util-visit";

/** Derives a readable label from a filename when no title is given, e.g. "10_Catalog_Dropdown.pdf" -> "Catalog Dropdown". */
function labelFromHref(href) {
	const filename = href.split("/").pop() ?? href;
	const withoutExt = filename.replace(/\.[^.]+$/, "");
	const withoutPrefix = withoutExt.replace(/^\d+[_-]?/, "");
	return withoutPrefix.replace(/[_-]+/g, " ").trim() || filename;
}

function buildIndexSection(entries) {
	return {
		type: "element",
		tagName: "section",
		properties: { className: ["citation-index"] },
		children: [
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
		],
	};
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
export default function rehypeCite() {
	return (tree) => {
		let counter = 0;
		const numberByHref = new Map();
		const entries = [];

		visit(tree, "element", (node, index, parent) => {
			if (!(parent && typeof index === "number" && node.tagName === "a" && node.properties?.href)) {
				return;
			}

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
			let number = numberByHref.get(href);
			if (number === undefined) {
				counter += 1;
				number = counter;
				numberByHref.set(href, number);
				entries.push({ href, label: node.properties?.title || labelFromHref(href) });
			}

			node.children[0].value = String(number);
			node.properties = {
				...node.properties,
				target: "_blank",
				rel: "noopener noreferrer",
			};

			parent.children[index] = {
				type: "element",
				tagName: "sup",
				properties: { className: ["citation"] },
				children: [node],
			};
		});

		if (entries.length > 0) {
			tree.children.push(buildIndexSection(entries));
		}
	};
}
