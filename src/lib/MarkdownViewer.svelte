<script lang="ts">
    import { tick } from "svelte";
    import "highlight.js/styles/github-dark.css";
    import UploadIcon from "~/lib/icons/UploadIcon.svelte";
    import ClearIcon from "~/lib/icons/ClearIcon.svelte";
    import { highlightCode, renderMarkdown, renderMermaid } from "~/utils/markdown";
    import type { UploadEvent } from "~/types";

    const EXAMPLE = `# Markdown viewer

Drop any \`.md\` file here. **GFM** tables, task lists, code highlighting and _mermaid_ diagrams are supported.

## Diagram

\`\`\`mermaid
flowchart LR
    A[Drop .md file] --> B{Parse}
    B --> C[Highlight code]
    B --> D[Render diagrams]
    C --> E((Done))
    D --> E
\`\`\`

## Code

\`\`\`ts
type User = { id: number; name: string };

export const greet = (user: User): string => \`Hello, \${user.name}!\`;
\`\`\`

## Table

| Feature  | Supported |
| -------- | :-------: |
| Tables   | ✅ |
| Mermaid  | ✅ |

- [x] Drag & drop
- [ ] Your file next
`;

    let fileName = $state("");
    let html = $state("");
    let errorText = $state("");
    let loading = $state(false);
    let dragDepth = $state(0);
    let content: HTMLDivElement | undefined = $state();
    let fileInput: HTMLInputElement;
    let renderToken = 0;

    const show = async (source: string, name: string) => {
        const token = ++renderToken;
        const isCurrent = () => token === renderToken;
        loading = true;
        errorText = "";
        try {
            const rendered = await renderMarkdown(source);
            if (!isCurrent()) return;
            fileName = name;
            html = rendered;
            await tick();
            if (!content) return;
            await Promise.all([highlightCode(content), renderMermaid(content, isCurrent)]);
        } catch (error) {
            if (isCurrent()) errorText = error instanceof Error ? error.message : String(error);
        } finally {
            if (isCurrent()) loading = false;
        }
    };

    const openFile = async (file: File) => {
        if (
            !/\.(md|markdown|mdx|mdown|mkd|txt)$/i.test(file.name) &&
            !file.type.startsWith("text/")
        ) {
            errorText = `"${file.name}" doesn't look like a Markdown file.`;
            return;
        }
        await show(await file.text(), file.name);
        window.scrollTo({ top: 0 });
    };

    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

    const handleDragEnter = (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth++;
    };

    const handleDragLeave = (event: DragEvent) => {
        if (!hasFiles(event)) return;
        dragDepth = Math.max(0, dragDepth - 1);
    };

    const handleDragOver = (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth = 0;
        const file = event.dataTransfer?.files[0];
        if (file) void openFile(file);
    };

    const handleFileChange = (event: UploadEvent) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void openFile(file);
    };

    const clear = () => {
        renderToken++;
        html = "";
        fileName = "";
        errorText = "";
        loading = false;
    };
</script>

<svelte:window
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondragover={handleDragOver}
    ondrop={handleDrop}
/>

<input
    bind:this={fileInput}
    class="file-input"
    type="file"
    accept=".md,.markdown,.mdx,.mdown,.mkd,.txt,text/markdown,text/plain"
    onchange={handleFileChange}
/>

{#if dragDepth > 0}
    <div class="drop-overlay" aria-hidden="true">
        <p>Drop your Markdown file</p>
    </div>
{/if}

{#if html}
    <div class="toolbar">
        <p class="file-name" title={fileName}>{fileName}</p>
        <div class="toolbar-actions">
            {#if loading}<span class="status">Rendering…</span>{/if}
            <button class="button" type="button" onclick={() => fileInput.click()}>
                <UploadIcon /> Open another
            </button>
            <button class="button" type="button" onclick={clear} aria-label="Close file">
                <ClearIcon />
            </button>
        </div>
    </div>
    {#if errorText}<p class="error-text">{errorText}</p>{/if}
    <div class="markdown-body" bind:this={content}>
        {@html html}
    </div>
{:else}
    <button class="drop-zone" type="button" onclick={() => fileInput.click()}>
        <UploadIcon width="48px" height="48px" />
        <span class="drop-zone-title">Drag & drop a Markdown file</span>
        <span class="drop-zone-hint">or click to browse — .md, .markdown, .mdx, .txt</span>
        {#if loading}<span class="status">Rendering…</span>{/if}
    </button>
    {#if errorText}<p class="error-text">{errorText}</p>{/if}
    <button class="example-link" type="button" onclick={() => show(EXAMPLE, "example.md")}>
        Try an example
    </button>
{/if}

<style lang="scss">
    .file-input {
        display: none;
    }

    .drop-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(18 18 18 / 85%);
        border: 3px dashed #4b5563;
        pointer-events: none;
        & p {
            font-size: 24px;
        }
    }

    .drop-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        min-height: 320px;
        padding: 32px 16px;
        border: 2px dashed #3a3a3a;
        border-radius: 8px;
        background: #030711;
        color: #e2e8f0;
        font-family: "NotoSans-Regular", sans-serif;
        transition: border-color 0.2s;
        &:hover,
        &:focus-visible {
            border-color: #6b7280;
        }
    }

    .drop-zone-title {
        font-size: 20px;
    }

    .drop-zone-hint {
        font-size: 14px;
        color: #9ca3af;
    }

    .example-link {
        margin: 16px auto 0;
        display: block;
        border: none;
        background: none;
        color: #9ca3af;
        font-family: "NotoSans-Regular", sans-serif;
        font-size: 14px;
        text-decoration: underline;
        &:hover {
            color: #e2e8f0;
        }
    }

    .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid #2c2c2c;
        border-radius: 8px 8px 0 0;
        background: #171717;
    }

    .file-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-family: "JetBrainsMono-Regular", monospace;
        font-size: 14px;
    }

    .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid #2c2c2c;
        border-radius: 6px;
        background: #1f1f1f;
        color: #e2e8f0;
        font-family: "NotoSans-Regular", sans-serif;
        font-size: 14px;
        &:hover {
            background: #2a2a2a;
        }
    }

    .status {
        font-size: 13px;
        color: #9ca3af;
    }

    .error-text {
        margin: 12px 0 0;
        color: #fca5a5;
        text-align: center;
    }

    /* Rendered Markdown: GitHub-like typography on the site's dark palette. */
    .markdown-body {
        padding: 24px 16px 40px;
        border: 1px solid #2c2c2c;
        border-top: none;
        border-radius: 0 0 8px 8px;
        background: #0d1117;
        color: #d1d5db;
        font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        overflow-wrap: break-word;
        @media (min-width: 768px) {
            padding: 32px 40px 48px;
        }

        & :global(*) {
            line-height: 1.6;
        }

        & > :global(:first-child) {
            margin-top: 0;
        }

        & :global(:is(h1, h2, h3, h4, h5, h6)) {
            margin: 24px 0 16px;
            font-family: inherit;
            font-weight: 600;
            line-height: 1.25;
            text-transform: none;
            color: #f0f6fc;
        }
        & :global(h1) {
            padding-bottom: 0.3em;
            border-bottom: 1px solid #30363d;
            font-size: 2em;
        }
        & :global(h2) {
            padding-bottom: 0.3em;
            border-bottom: 1px solid #30363d;
            font-size: 1.5em;
        }
        & :global(h3) {
            font-size: 1.25em;
        }
        & :global(h4) {
            font-size: 1em;
        }
        & :global(:is(h5, h6)) {
            font-size: 0.875em;
        }

        & :global(:is(p, ul, ol, blockquote, table, pre, figure, details, hr)) {
            margin: 0 0 16px;
        }

        & :global(p) {
            font-family: inherit;
            font-size: inherit;
            color: inherit;
        }

        & :global(a) {
            color: #4493f8;
            &:hover {
                text-decoration: underline;
            }
        }

        & :global(strong) {
            color: #f0f6fc;
        }

        & :global(:is(ul, ol)) {
            padding-left: 2em;
        }
        & :global(ul) {
            list-style: disc;
        }
        & :global(ol) {
            list-style: decimal;
        }
        & :global(li + li) {
            margin-top: 0.25em;
        }
        & :global(:is(ul, ol) :is(ul, ol)) {
            margin: 0.25em 0 0;
        }
        & :global(li:has(> input[type="checkbox"])) {
            list-style: none;
        }
        & :global(li > input[type="checkbox"]) {
            margin: 0 0.4em 0 -1.4em;
            vertical-align: middle;
        }

        & :global(blockquote) {
            padding: 0 1em;
            border-left: 0.25em solid #3d444d;
            color: #9198a1;
        }

        & :global(hr) {
            height: 0.25em;
            border: 0;
            background: #30363d;
        }

        & :global(img) {
            max-width: 100%;
        }

        & :global(code) {
            padding: 0.2em 0.4em;
            border-radius: 6px;
            background: rgb(101 108 118 / 20%);
            font-family: "JetBrainsMono-Regular", ui-monospace, monospace;
            font-size: 85%;
        }

        & :global(pre) {
            overflow: auto;
            padding: 16px;
            border-radius: 6px;
            background: #151b23;
            & :global(code) {
                display: block;
                padding: 0;
                background: transparent;
                font-size: 14px;
                white-space: pre;
            }
            & :global(code.hljs) {
                padding: 0;
                background: transparent;
            }
        }

        & :global(table) {
            display: block;
            width: max-content;
            max-width: 100%;
            overflow: auto;
            border-collapse: collapse;
        }
        & :global(:is(th, td)) {
            padding: 6px 13px;
            border: 1px solid #3d444d;
        }
        & :global(th) {
            font-weight: 600;
            color: #f0f6fc;
        }
        & :global(tr:nth-child(2n)) {
            background: #151b23;
        }

        & :global(.mermaid-diagram) {
            overflow-x: auto;
            padding: 16px;
            border-radius: 6px;
            background: #151b23;
            text-align: center;
            & :global(svg) {
                max-width: 100%;
                height: auto;
            }
        }
        & :global(.mermaid-error p) {
            margin: 0 0 8px;
            color: #fca5a5;
            text-align: left;
            font-size: 14px;
        }
    }
</style>
