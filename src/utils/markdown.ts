/**
 * Markdown rendering for the /markdown-viewer page.
 * marked, DOMPurify, highlight.js and mermaid (~3 MB) are loaded on first use
 * so the page itself ships only the drop zone.
 */

export const renderMarkdown = async (source: string): Promise<string> => {
    const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import("marked"),
        import("dompurify")
    ]);
    const html = await marked.parse(source, { gfm: true });
    return DOMPurify.sanitize(html);
};

const languageOf = (code: Element) =>
    [...code.classList].find((c) => c.startsWith("language-"))?.slice("language-".length);

export const highlightCode = async (root: HTMLElement) => {
    const blocks = [...root.querySelectorAll<HTMLElement>("pre > code")].filter((code) => {
        const lang = languageOf(code);
        return lang && lang !== "mermaid";
    });
    if (blocks.length === 0) return;

    const { default: hljs } = await import("highlight.js/lib/common");
    hljs.configure({ ignoreUnescapedHTML: true });
    for (const code of blocks) {
        // Unknown languages are left as plain text instead of logging a warning.
        if (hljs.getLanguage(languageOf(code) ?? "")) hljs.highlightElement(code);
    }
};

let diagramId = 0;

/** Replaces ```mermaid blocks with rendered SVG; stops once `isCurrent` turns false (a newer file was opened). */
export const renderMermaid = async (root: HTMLElement, isCurrent: () => boolean) => {
    const blocks = [...root.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];
    if (blocks.length === 0) return;

    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });

    for (const code of blocks) {
        if (!isCurrent()) return;
        const pre = code.parentElement!;
        const figure = document.createElement("figure");
        figure.className = "mermaid-diagram";
        try {
            const { svg } = await mermaid.render(`mermaid-${++diagramId}`, code.textContent ?? "");
            figure.innerHTML = svg;
        } catch (error) {
            figure.classList.add("mermaid-error");
            const message = document.createElement("p");
            message.textContent = `Mermaid: ${error instanceof Error ? error.message : String(error)}`;
            figure.append(message, pre.cloneNode(true));
        }
        if (isCurrent()) pre.replaceWith(figure);
    }
};
