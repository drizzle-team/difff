<script lang="ts">
    import { onMount, tick } from "svelte";
    import UploadIcon from "~/lib/icons/UploadIcon.svelte";
    import CloseIcon from "~/lib/icons/searchFieldIcons/CloseIcon.svelte";
    import { renderDocument } from "~/utils/markdown";
    import {
        ApiError,
        createShare,
        fetchShare,
        savedPin,
        savePin,
        shareIdFromPath,
        timeLeft,
        type CreatedShare
    } from "~/utils/share";
    import type { UploadEvent } from "~/types";

    /*
     * File System Access API (Chromium only, not in lib.dom yet). A handle lets us re-read
     * the file from disk to detect edits. Other browsers fall back to a one-off File.
     */
    type HandleItem = DataTransferItem & {
        getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
    };
    type PickerWindow = Window & {
        showOpenFilePicker?: (options?: {
            types?: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<FileSystemFileHandle[]>;
    };

    const POLL_MS = 1000;
    const MAX_FAILURES = 3;
    const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdx", ".mdown", ".mkd"];
    const VIEWER_PATH = "/markdown-viewer";

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

| Feature  | Supported | Notes |
| -------- | :-------: | ----- |
| Tables   | ✅ | Wide tables scroll horizontally |
| Mermaid  | ✅ | Flowcharts, sequence, class, state, ER, Gantt, pie |
| Sharing  | ✅ | Temporary link, valid for 24 hours |

> Blockquotes look like this.

- [x] Drag & drop
- [ ] Your file next
`;

    // Document
    let fileName = $state("");
    let hasDocument = $state(false);
    let errorText = $state("");
    let loading = $state(false);
    let dragDepth = $state(0);
    let content: HTMLDivElement | undefined = $state();
    let scroller: HTMLDivElement | undefined = $state();
    let fileInput: HTMLInputElement;
    let renderToken = 0;
    /** Source text currently rendered: what gets shared, and what disk changes compare against. */
    let shownSource = $state("");

    // Watching the file on disk
    /** Set when the browser gave us a handle to the file on disk (Chromium). */
    let handle = $state<FileSystemFileHandle | null>(null);
    /** The file on disk differs from what is rendered; shows the "Sync" button. */
    let changed = $state(false);
    /** Metadata of the last version we read, for the cheap per-poll check. */
    let seen = { lastModified: 0, size: 0 };
    let checking = false;
    let failures = 0;

    // Sharing
    /** Link created for this document; `sharedSource` is the text it was created from. */
    let shareLink = $state<CreatedShare | null>(null);
    let sharedSource = $state("");
    let sharing = $state(false);
    let copied = $state(false);
    /** Creating links needs the owner's PIN; asked once, then remembered in this browser. */
    let askPin = $state(false);
    let pinInput = $state("");
    let pinError = $state("");
    /** Set when viewing someone's /md/:id link (read-only, no file on disk). */
    let sharedView = $state<{ expiresAt: string } | null>(null);
    let now = $state(Date.now());

    const shareIsStale = $derived(shareLink !== null && sharedSource !== shownSource);
    const expiresAt = $derived(sharedView?.expiresAt ?? shareLink?.expiresAt ?? null);

    const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

    const show = async (source: string, name: string) => {
        const token = ++renderToken;
        const isCurrent = () => token === renderToken;
        loading = true;
        errorText = "";
        try {
            const rendered = await renderDocument(source, isCurrent);
            if (!rendered) return;
            fileName = name;
            hasDocument = true;
            await tick();
            // One-step swap keeps the scroll position when a synced file re-renders.
            content?.replaceChildren(...rendered.childNodes);
            shownSource = source;
            return true;
        } catch (error) {
            if (isCurrent()) errorText = messageOf(error);
        } finally {
            if (isCurrent()) loading = false;
        }
    };

    /** Shows a new document (as opposed to re-rendering the current one). */
    const showNew = async (source: string, name: string) => {
        shareLink = null;
        sharedSource = "";
        if (await show(source, name)) scroller?.scrollTo({ top: 0 });
    };

    const isMarkdown = (file: File) =>
        [...MARKDOWN_EXTENSIONS, ".txt"].some((ext) => file.name.toLowerCase().endsWith(ext)) ||
        file.type.startsWith("text/");

    const openFile = async (file: File, fileHandle: FileSystemFileHandle | null = null) => {
        if (!isMarkdown(file)) {
            errorText = `"${file.name}" doesn't look like a Markdown file.`;
            return;
        }
        leaveSharedView();
        handle = fileHandle;
        seen = { lastModified: file.lastModified, size: file.size };
        changed = false;
        failures = 0;
        await showNew(await file.text(), file.name);
    };

    const openExample = () => {
        handle = null;
        changed = false;
        void showNew(EXAMPLE, "example.md");
    };

    const stopWatching = () => {
        handle = null;
        changed = false;
        errorText = `Can't read "${fileName}" anymore. It was moved or deleted. Drop it again to keep watching.`;
    };

    /**
     * Two-step check: size + last-modified are free to read (getFile() doesn't read the
     * contents), so we only read the text when they move, then compare it to what's rendered.
     * That ignores saves without edits, and the button disappears if an edit is undone.
     */
    const checkForChanges = async () => {
        const current = handle;
        if (!current || checking) return;
        checking = true;
        try {
            const file = await current.getFile();
            if (current !== handle) return;
            failures = 0;
            if (file.lastModified === seen.lastModified && file.size === seen.size) return;
            seen = { lastModified: file.lastModified, size: file.size };
            const text = await file.text();
            if (current === handle) changed = text !== shownSource;
        } catch {
            // Editors often save by writing a temp file and renaming it, so a single failed
            // read mid-save is normal; give up only after several in a row.
            if (current === handle && ++failures >= MAX_FAILURES) stopWatching();
        } finally {
            checking = false;
        }
    };

    /** Re-reads the file at click time, so the latest version is rendered. */
    const sync = async () => {
        const current = handle;
        if (!current) return;
        try {
            const file = await current.getFile();
            const text = await file.text();
            if (current !== handle) return;
            seen = { lastModified: file.lastModified, size: file.size };
            await show(text, file.name);
            changed = false;
        } catch {
            if (current === handle) stopWatching();
        }
    };

    // Poll for changes; also re-check as soon as the tab regains focus.
    $effect(() => {
        if (!handle) return;
        const poll = () => {
            if (!document.hidden) void checkForChanges();
        };
        const timer = setInterval(poll, POLL_MS);
        window.addEventListener("focus", poll);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", poll);
        };
    });

    // Keep the "expires in" countdown fresh.
    $effect(() => {
        if (!expiresAt) return;
        now = Date.now();
        const timer = setInterval(() => (now = Date.now()), 30_000);
        return () => clearInterval(timer);
    });

    // The viewer is full screen: stop the page underneath from scrolling.
    $effect(() => {
        if (!hasDocument) return;
        const { style } = document.documentElement;
        const previous = style.overflow;
        style.overflow = "hidden";
        return () => {
            style.overflow = previous;
        };
    });

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            // Clipboard blocked: the link is still visible in the share bar to copy by hand.
        }
    };

    const upload = async (pin: string) => {
        sharing = true;
        errorText = "";
        pinError = "";
        try {
            const source = shownSource;
            shareLink = await createShare(fileName, source, pin);
            sharedSource = source;
            savePin(pin);
            askPin = false;
            pinInput = "";
            await copy(shareLink.url);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                savePin(null);
                askPin = true;
                pinError = error.message;
            } else {
                errorText = messageOf(error);
            }
        } finally {
            sharing = false;
        }
    };

    const share = async () => {
        if (sharedView) return copy(location.href);
        if (shareLink && !shareIsStale) return copy(shareLink.url);
        const pin = savedPin();
        if (pin) return upload(pin);
        askPin = true;
    };

    const submitPin = (event: SubmitEvent) => {
        event.preventDefault();
        if (pinInput) void upload(pinInput);
    };

    const cancelPin = () => {
        askPin = false;
        pinInput = "";
        pinError = "";
    };

    const shareLabel = $derived.by(() => {
        if (sharing) return "Sharing…";
        if (copied) return "Copied!";
        if (sharedView || (shareLink && !shareIsStale)) return "Copy link";
        return shareIsStale ? "Share new version" : "Share";
    });

    const leaveSharedView = () => {
        if (!sharedView) return;
        sharedView = null;
        if (shareIdFromPath(location.pathname)) history.replaceState(null, "", VIEWER_PATH);
    };

    const close = () => {
        renderToken++;
        leaveSharedView();
        handle = null;
        changed = false;
        shareLink = null;
        sharedSource = "";
        shownSource = "";
        cancelPin();
        hasDocument = false;
        fileName = "";
        errorText = "";
        loading = false;
    };

    // Opened from a share link (/md/:id): load it read-only.
    onMount(() => {
        const id = shareIdFromPath(location.pathname);
        if (!id) return;
        loading = true;
        fetchShare(id)
            .then(async (shared) => {
                sharedView = { expiresAt: shared.expiresAt };
                await show(shared.content, shared.name);
            })
            .catch((error: unknown) => {
                errorText = messageOf(error);
                history.replaceState(null, "", VIEWER_PATH);
            })
            .finally(() => (loading = false));
    });

    const browse = async () => {
        const picker = (window as PickerWindow).showOpenFilePicker;
        if (!picker) return fileInput.click();
        try {
            const [fileHandle] = await picker({
                types: [
                    {
                        description: "Markdown",
                        accept: { "text/markdown": MARKDOWN_EXTENSIONS, "text/plain": [".txt"] }
                    }
                ]
            });
            if (fileHandle) await openFile(await fileHandle.getFile(), fileHandle);
        } catch (error) {
            // AbortError = the user closed the picker.
            if (!(error instanceof DOMException && error.name === "AbortError")) fileInput.click();
        }
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
        if (!file) return;
        // getAsFileSystemHandle must be called synchronously, before the drop event ends.
        const item = [...(event.dataTransfer?.items ?? [])].find((i) => i.kind === "file") as
            | HandleItem
            | undefined;
        const pending = item?.getAsFileSystemHandle?.().catch(() => null);
        void (async () => {
            const fileHandle = await pending;
            await openFile(
                file,
                fileHandle?.kind === "file" ? (fileHandle as FileSystemFileHandle) : null
            );
        })();
    };

    const handleFileChange = (event: UploadEvent) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void openFile(file);
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && hasDocument) close();
    };
</script>

<svelte:window
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondragover={handleDragOver}
    ondrop={handleDrop}
    onkeydown={handleKeydown}
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

{#if hasDocument}
    <div class="viewer" role="dialog" aria-modal="true" aria-label={fileName}>
        <div class="toolbar">
            <div class="file-info">
                <p class="file-name" title={fileName}>{fileName}</p>
                {#if sharedView && expiresAt}
                    <span class="status">Shared · expires in {timeLeft(expiresAt, now)}</span>
                {:else if loading}
                    <span class="status">Rendering…</span>
                {/if}
            </div>
            <div class="toolbar-actions">
                {#if changed}
                    <button
                        class="button sync-button"
                        type="button"
                        onclick={sync}
                        title="The file changed on disk. Click to render the latest version."
                    >
                        <span class="changed-dot"></span> Changed · Sync
                    </button>
                {:else if handle}
                    <span
                        class="status watching"
                        title="You'll see a Sync button when the file changes on disk"
                    >
                        Watching for changes
                    </span>
                {/if}
                <button
                    class="button share-button"
                    type="button"
                    onclick={share}
                    disabled={sharing}
                    title={sharedView
                        ? "Copy this link"
                        : "Upload this file and copy a link anyone can open for 24 hours"}
                >
                    {shareLabel}
                </button>
                <button class="button" type="button" onclick={browse}>
                    <UploadIcon /> <span class="hide-mobile">Open file</span>
                </button>
                <button
                    class="button icon-button"
                    type="button"
                    onclick={close}
                    aria-label="Close viewer"
                    title="Close (Esc)"
                >
                    <CloseIcon />
                </button>
            </div>
        </div>

        {#if errorText}
            <p class="banner error-banner" role="alert">{errorText}</p>
        {/if}
        {#if askPin && !sharedView}
            <form class="banner share-banner" onsubmit={submitPin}>
                <label class="pin-label" for="share-pin">PIN to create a 24-hour link</label>
                <!-- svelte-ignore a11y_autofocus -->
                <input
                    id="share-pin"
                    class="share-url pin-input"
                    type="password"
                    autocomplete="off"
                    autofocus
                    bind:value={pinInput}
                    aria-invalid={pinError ? "true" : undefined}
                />
                <button class="button share-button" type="submit" disabled={!pinInput || sharing}>
                    {sharing ? "Creating…" : "Create link"}
                </button>
                <button class="button" type="button" onclick={cancelPin}>Cancel</button>
                {#if pinError}<span class="pin-error" role="alert">{pinError}</span>{/if}
            </form>
        {/if}
        {#if shareLink && !sharedView}
            <div class="banner share-banner">
                {#if shareIsStale}
                    <span
                        >The file changed since you shared it. The link still shows the old version.</span
                    >
                {:else}
                    <input
                        class="share-url"
                        readonly
                        value={shareLink.url}
                        aria-label="Share link"
                        onfocus={(event) => event.currentTarget.select()}
                    />
                    <span class="status">
                        Anyone with the link can view · expires in {timeLeft(
                            shareLink.expiresAt,
                            now
                        )}
                    </span>
                {/if}
            </div>
        {/if}

        <div class="viewer-scroll" bind:this={scroller}>
            <div class="markdown-body" bind:this={content}></div>
        </div>
    </div>
{/if}

<button class="drop-zone" type="button" onclick={browse}>
    <UploadIcon width="48px" height="48px" />
    <span class="drop-zone-title">Drag & drop a Markdown file</span>
    <span class="drop-zone-hint">or click to browse — .md, .markdown, .mdx, .txt</span>
    {#if loading && !hasDocument}<span class="status">Loading…</span>{/if}
</button>
{#if errorText && !hasDocument}<p class="error-text" role="alert">{errorText}</p>{/if}
<button class="example-link" type="button" onclick={openExample}>Try an example</button>

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
        background: rgb(17 17 17 / 85%);
        border: 3px dashed #404040;
        pointer-events: none;
        & p {
            font-size: 24px;
            color: #c8c9ca;
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
        border: 2px dashed #292929;
        border-radius: 8px;
        background: #1a1a1a;
        color: #c8c9ca;
        font-family: "NotoSans-Regular", sans-serif;
        transition: border-color 0.2s;
        &:hover,
        &:focus-visible {
            border-color: #6b737c;
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
            color: #e5e7eb;
        }
    }

    .error-text {
        margin: 12px 0 0;
        color: #fca5a5;
        text-align: center;
    }

    /* Full-screen viewer, styled after the Drizzle ORM docs (dark theme). */
    .viewer {
        --bg: #111111;
        --surface: #1a1a1a;
        --raised: #1c1c1c;
        --hover: #282828;
        --border: #292929;
        --border-strong: #404040;
        --text: #c4c5c6;
        --heading: #c8c9ca;
        --muted: #9ca3af;
        --link: #4d9fff;
        --font:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif,
            "Apple Color Emoji", "Segoe UI Emoji";
        --mono: "JetBrainsMono-Regular", ui-monospace, SFMono-Regular, Menlo, monospace;

        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        color: var(--text);
        font-family: var(--font);
    }

    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-shrink: 0;
        padding: 10px 16px;
        background: #121212;
        box-shadow: inset 0 -1px #ffffff1a;
        @media (min-width: 768px) {
            padding: 10px 24px;
        }
    }

    .file-info {
        display: flex;
        align-items: baseline;
        gap: 12px;
        min-width: 0;
    }

    .file-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-family: var(--mono);
        font-size: 14px;
        color: var(--heading);
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
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--raised);
        color: var(--heading);
        font-family: var(--font);
        font-size: 14px;
        white-space: nowrap;
        &:hover:not(:disabled) {
            background: var(--hover);
        }
        &:focus-visible {
            outline: 2px solid var(--link);
            outline-offset: 1px;
        }
    }

    .icon-button {
        padding: 0 6px;
    }

    .share-button {
        border-color: #1f4f8a;
        background: rgb(0 107 230 / 15%);
        color: #9cc8ff;
        &:hover:not(:disabled) {
            background: rgb(0 107 230 / 25%);
        }
    }

    /* GitHub-PR-style "changed" pill: amber, stands out from the neutral buttons. */
    .sync-button {
        border-color: #9e6a03;
        background: rgb(187 128 9 / 15%);
        color: #e3b341;
        &:hover {
            background: rgb(187 128 9 / 25%);
        }
    }

    .changed-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e3b341;
    }

    .status {
        font-size: 13px;
        color: var(--muted, #9ca3af);
        white-space: nowrap;
    }

    .watching,
    .hide-mobile {
        @media (max-width: 767px) {
            display: none;
        }
    }

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        flex-shrink: 0;
        padding: 8px 16px;
        border-bottom: 1px solid var(--border);
        font-size: 14px;
        @media (min-width: 768px) {
            padding: 8px 24px;
        }
    }

    .error-banner {
        background: rgb(248 113 113 / 10%);
        color: #fca5a5;
        font-family: var(--font);
    }

    .share-banner {
        background: var(--surface);
    }

    .share-url {
        flex: 1 1 280px;
        max-width: 520px;
        height: 30px;
        padding: 0 8px;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--bg);
        color: var(--heading);
        font-family: var(--mono);
        font-size: 13px;
    }

    .pin-label {
        color: var(--heading);
    }

    .pin-input {
        flex: 0 1 200px;
    }

    .pin-error {
        color: #fca5a5;
    }

    .viewer-scroll {
        flex: 1;
        overflow: auto;
        overscroll-behavior: contain;
    }

    /* Rendered Markdown. Wide column so tables and code fit; text stays readable at 16px. */
    .markdown-body {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px 16px 64px;
        font-family: var(--font);
        font-size: 16px;
        line-height: 1.5;
        overflow-wrap: break-word;
        -webkit-font-smoothing: auto;
        @media (min-width: 1280px) {
            padding: 32px 48px 80px;
        }

        & :global(*) {
            line-height: 1.5;
        }

        & > :global(:first-child) {
            margin-top: 0;
        }

        & :global(:is(h1, h2, h3, h4, h5, h6)) {
            margin: 32px 0 0;
            padding: 3px 0;
            font-family: var(--font);
            font-weight: 600;
            letter-spacing: -0.015em;
            line-height: 1.25;
            text-transform: none;
            color: var(--heading);
        }
        & :global(h1) {
            padding: 4px 0 6px;
            font-size: 32px;
            font-weight: 700;
            @media (max-width: 768px) {
                font-size: 24px;
            }
        }
        & :global(h2) {
            font-size: 24px;
        }
        & :global(:is(h3, h4)) {
            font-size: 20px;
        }
        & :global(h5) {
            margin-top: 16px;
            font-size: 1.125rem;
        }
        & :global(h6) {
            margin-top: 16px;
            font-size: 1rem;
        }
        & :global(:is(h1, h2, h3, h4, h5, h6) code) {
            font-size: 0.8125em;
        }

        & :global(p) {
            padding: 6px 0;
            font-family: var(--font);
            font-size: inherit;
            line-height: 1.5;
            color: var(--text);
        }
        & :global(:is(h1, h2, h3, h4) + p) {
            padding-top: 3px;
        }

        & :global(a) {
            color: var(--link);
            text-underline-position: from-font;
            &:hover {
                text-decoration: underline;
            }
        }

        & :global(strong) {
            font-weight: bolder;
            color: var(--heading);
        }
        & :global(em) {
            font-style: italic;
        }

        & :global(:is(ul, ol)) {
            margin: 0 0 0 1.2rem;
            padding: 0;
        }
        & :global(ul) {
            list-style: disc;
        }
        & :global(ol) {
            list-style: decimal;
        }
        & :global(li) {
            padding: 2px 0;
        }
        & :global(li p) {
            padding: 0;
        }
        & :global(li :is(ul, ol)) {
            margin-top: 2px;
            margin-bottom: 2px;
        }
        & :global(li:has(> input[type="checkbox"])) {
            list-style: none;
        }
        & :global(li > input[type="checkbox"]) {
            margin: 0 0.4em 0 -1.2rem;
            vertical-align: middle;
            accent-color: var(--link);
        }

        & :global(blockquote) {
            position: relative;
            margin: 6px 0;
            padding: 8px 12px 8px 16px;
            background: var(--surface);
            font-size: 14px;
            &::before {
                content: "";
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                width: 4px;
                background: var(--text);
            }
            & :global(p) {
                padding: 2px 0;
                font-size: 14px;
            }
        }

        & :global(hr) {
            margin: 16px 0;
            border: 0;
            border-top: 1px solid var(--border);
        }

        & :global(img) {
            max-width: 100%;
        }

        & :global(code) {
            padding: 2px 3px;
            border: 1px solid var(--border);
            border-radius: 2px;
            background: var(--surface);
            color: var(--text);
            font-family: var(--mono);
            font-size: 0.8125em;
            line-height: normal;
        }

        & :global(pre) {
            margin: 8px 0;
            overflow: auto;
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--surface);
            & :global(code) {
                display: block;
                padding: 0;
                border: 0;
                background: transparent;
                color: #d1d1d1;
                font-size: 13px;
                line-height: 1.6;
                white-space: pre;
            }
        }

        /* Tables: underline-only rows like Drizzle; as wide as the content needs, scroll beyond. */
        & :global(table) {
            display: block;
            width: max-content;
            max-width: 100%;
            margin: 4px 0 8px;
            overflow-x: auto;
            border-collapse: collapse;
            font-size: 14px;
            scrollbar-color: #4d4d4d transparent;
        }
        & :global(th) {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-strong);
            font-weight: 600;
            text-align: left;
            color: var(--heading);
        }
        & :global(td) {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
        }
        & :global(tbody tr:last-child td) {
            border-color: var(--border-strong);
        }
        & :global(:is(th, td):first-child) {
            padding-left: 0;
        }
        & :global(:is(th, td) code) {
            white-space: nowrap;
        }

        & :global(.mermaid-diagram) {
            margin: 8px 0;
            overflow-x: auto;
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--surface);
            text-align: center;
            & :global(svg) {
                max-width: 100%;
                height: auto;
            }
        }
        & :global(.mermaid-error p) {
            padding: 0 0 8px;
            color: #fca5a5;
            text-align: left;
            font-size: 14px;
        }

        /* highlight.js tokens mapped to Drizzle's dark code palette. */
        & :global(.hljs-keyword),
        & :global(.hljs-operator),
        & :global(.hljs-selector-tag),
        & :global(.hljs-deletion),
        & :global(.hljs-meta .hljs-keyword) {
            color: #f97583;
        }
        & :global(.hljs-string),
        & :global(.hljs-regexp),
        & :global(.hljs-meta .hljs-string),
        & :global(.hljs-link) {
            color: #ffab70;
        }
        & :global(.hljs-number),
        & :global(.hljs-literal),
        & :global(.hljs-built_in),
        & :global(.hljs-type),
        & :global(.hljs-attr),
        & :global(.hljs-attribute),
        & :global(.hljs-property),
        & :global(.hljs-symbol),
        & :global(.hljs-variable.constant_),
        & :global(.hljs-variable.language_),
        & :global(.hljs-selector-class),
        & :global(.hljs-selector-id),
        & :global(.hljs-name),
        & :global(.hljs-tag) {
            color: #79b8ff;
        }
        & :global(.hljs-title),
        & :global(.hljs-title.function_),
        & :global(.hljs-title.class_),
        & :global(.hljs-section) {
            color: #b392f0;
        }
        & :global(.hljs-params) {
            color: #d1d1d1;
        }
        & :global(.hljs-comment),
        & :global(.hljs-quote),
        & :global(.hljs-meta) {
            color: #6b737c;
        }
        & :global(.hljs-punctuation) {
            color: #bbb;
        }
        & :global(.hljs-addition),
        & :global(.hljs-template-variable),
        & :global(.hljs-subst) {
            color: #4bb74a;
        }
        & :global(.hljs-emphasis) {
            font-style: italic;
        }
        & :global(.hljs-strong) {
            font-weight: bold;
        }
    }
</style>
