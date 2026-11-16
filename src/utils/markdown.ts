/**
 * Markdown rendering for the /markdown-viewer page.
 * marked, DOMPurify, highlight.js and mermaid (~3 MB) are loaded on first use
 * so the page itself ships only the drop zone.
 */

const renderMarkdown = async (source: string): Promise<string> => {
    const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import("marked"),
        import("dompurify")
    ]);
    const html = await marked.parse(source, { gfm: true });
    return DOMPurify.sanitize(html);
};

/**
 * Renders Markdown into a detached element, with code highlighted and diagrams drawn,
 * so it can be swapped into the page in one step (no flash of raw mermaid code on reload).
 * Resolves to `null` once `isCurrent` turns false (a newer render started).
 */
export const renderDocument = async (
    source: string,
    isCurrent: () => boolean
): Promise<HTMLElement | null> => {
    const root = document.createElement("div");
    root.innerHTML = await renderMarkdown(source);
    if (!isCurrent()) return null;
    wrapTables(root);
    await Promise.all([highlightCode(root), renderMermaid(root, isCurrent)]);
    return isCurrent() ? root : null;
};

/** Tables scroll inside a wrapper, so the table itself can stretch to the wrapper's width. */
const wrapTables = (root: HTMLElement) => {
    for (const table of root.querySelectorAll("table")) {
        const wrap = document.createElement("div");
        wrap.className = "table-wrap";
        table.replaceWith(wrap);
        wrap.append(table);
    }
};

/**
 * Mermaid emits `width="100%"` plus an inline `max-width: <natural>px`, which gives the SVG no
 * intrinsic width (a max-content container collapses it). Use the natural width instead and
 * let CSS scale it down on narrow screens.
 */
const sizeDiagram = (figure: HTMLElement) => {
    const svg = figure.querySelector("svg");
    const naturalWidth = svg ? Number.parseFloat(svg.style.maxWidth) : Number.NaN;
    if (!svg || !Number.isFinite(naturalWidth)) return;
    svg.setAttribute("width", String(naturalWidth));
    svg.removeAttribute("height");
    svg.style.maxWidth = "100%";
};

const languageOf = (code: Element) =>
    [...code.classList].find((c) => c.startsWith("language-"))?.slice("language-".length);

const highlightCode = async (root: HTMLElement) => {
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
const renderMermaid = async (root: HTMLElement, isCurrent: () => boolean) => {
    const blocks = [...root.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];
    if (blocks.length === 0) return;

    const { default: mermaid } = await import("mermaid");
    // "base" is the only customizable theme; colors follow the viewer's Drizzle-style palette.
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
            darkMode: true,
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
            fontSize: "14px",
            background: "#1a1a1a",
            primaryColor: "#232323",
            primaryTextColor: "#c8c9ca",
            primaryBorderColor: "#404040",
            secondaryColor: "#282828",
            tertiaryColor: "#1c1c1c",
            lineColor: "#6b737c",
            textColor: "#c4c5c6",
            mainBkg: "#232323",
            nodeBorder: "#404040",
            clusterBkg: "#141414",
            clusterBorder: "#292929",
            edgeLabelBackground: "#1a1a1a",
            noteBkgColor: "#282a36",
            noteTextColor: "#c8c9ca",
            noteBorderColor: "#404040",
            actorBkg: "#232323",
            actorBorder: "#404040",
            actorTextColor: "#c8c9ca",
            signalColor: "#c4c5c6",
            signalTextColor: "#c4c5c6"
        }
    });

    for (const code of blocks) {
        if (!isCurrent()) return;
        const pre = code.parentElement!;
        const figure = document.createElement("figure");
        figure.className = "mermaid-diagram";
        try {
            const { svg } = await mermaid.render(`mermaid-${++diagramId}`, code.textContent ?? "");
            figure.innerHTML = svg;
            sizeDiagram(figure);
        } catch (error) {
            figure.classList.add("mermaid-error");
            const message = document.createElement("p");
            message.textContent = `Mermaid: ${error instanceof Error ? error.message : String(error)}`;
            figure.append(message, pre.cloneNode(true));
        }
        if (isCurrent()) pre.replaceWith(figure);
    }
};
