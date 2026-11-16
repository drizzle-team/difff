<script lang="ts">
    import CopyIcon from "~/lib/icons/CopyIcon.svelte";
    import DownloadIcon from "~/lib/icons/DownloadScon.svelte";
    import ClearIcon from "~/lib/icons/ClearIcon.svelte";
    import MagicWandIcon from "~/lib/icons/MagicWandIcon.svelte";
    import SuccessIcon from "~/lib/icons/SuccessIcon.svelte";
    import { getColumn, getLine } from "~/lib/shared/Codemirror/components/utils";
    import { storageSettings } from "~/storage/store";
    import type { Formats } from "~/types";

    interface Props {
        dividerPos: number;
        formatLeft: Formats;
        cursorPositionLeft: { line: number; col: number };
        isFormatClicked: boolean;
        isClearClicked: boolean;
        handleFormatClick: () => void;
        handleClearClick: () => void;
        formatRight: Formats;
        cursorPositionRight: { line: number; col: number };
        isDownloadClicked: boolean;
        isCopyClicked: boolean;
        handleCopyClick: () => void;
        handleDownloadClick: () => void;
    }

    let {
        dividerPos,
        formatLeft,
        cursorPositionLeft,
        isFormatClicked,
        isClearClicked,
        handleFormatClick,
        handleClearClick,
        formatRight,
        cursorPositionRight,
        isDownloadClicked,
        isCopyClicked,
        handleCopyClick,
        handleDownloadClick
    }: Props = $props();

    let useTabsLeft: boolean = $derived($storageSettings[formatLeft].tab || false);
    let indentationLevelLeft: number = $derived($storageSettings[formatLeft].spaces);
    let useTabsRight: boolean = $derived($storageSettings[formatRight].tab || false);
    let indentationLevelRight: number = $derived($storageSettings[formatRight].spaces);

    let lineLeft = $derived(getLine(cursorPositionLeft.line));
    let columnLeft = $derived(getColumn(cursorPositionLeft.col));
    let lineRight = $derived(getLine(cursorPositionRight.line));
    let columnRight = $derived(getColumn(cursorPositionRight.col));
</script>

<div class="footer_wrapper" style={`--pos: ${dividerPos}%;`}>
    <div class="footer">
        <div>
            <span class="cursor-position">
                Ln {lineLeft}, Col {columnLeft}
            </span>
            <span class="cursor-position">
                {useTabsLeft ? "Tab Size" : "Spaces"}: {indentationLevelLeft}
            </span>
        </div>
        <div class="icon-btn-wrap">
            <button
                onclick={handleFormatClick}
                title="download"
                aria-label="download"
                aria-labelledby="download"
                name="download"
                class="icon-button"
            >
                {#if isFormatClicked}
                    <SuccessIcon />
                {:else}
                    <MagicWandIcon />
                {/if}
            </button>
            <button
                onclick={handleClearClick}
                title="copy"
                aria-label="copy"
                aria-labelledby="copy"
                name="copy"
                class="icon-button"
            >
                {#if isClearClicked}
                    <SuccessIcon />
                {:else}
                    <ClearIcon />
                {/if}
            </button>
        </div>
    </div>
    <div class="divider"></div>
    <div class="footer">
        <div>
            <span class="cursor-position">
                Ln {lineRight}, Col {columnRight}
            </span>
            <span class="cursor-position">
                {useTabsRight ? "Tab Size" : "Spaces"}: {indentationLevelRight}
            </span>
        </div>
        <div class="icon-btn-wrap">
            <button
                onclick={handleDownloadClick}
                title="download"
                aria-label="download"
                aria-labelledby="download"
                name="download"
                class="icon-button"
            >
                {#if isDownloadClicked}
                    <SuccessIcon />
                {:else}
                    <DownloadIcon />
                {/if}
            </button>
            <button
                onclick={handleCopyClick}
                title="copy"
                aria-label="copy"
                aria-labelledby="copy"
                name="copy"
                class="icon-button"
            >
                {#if isCopyClicked}
                    <SuccessIcon />
                {:else}
                    <CopyIcon />
                {/if}
            </button>
        </div>
    </div>
</div>

<style lang="scss">
    .footer_wrapper {
        position: relative;
        display: grid;
        grid-template-columns: var(--pos) 1fr;
        height: 54px;
        background: #030711;
        border-top: 1px solid #313345;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px;
    }

    .icon-btn-wrap {
        display: flex;
        gap: 8px;
    }

    .icon-button {
        display: flex;
        align-items: center;
        height: 36px;
        gap: 4px;
        padding: 0 8px;
        background: #030711;
        border: 1px solid #313345;
        border-radius: 8px;
        color: #7d8799;
        transition: all 0.2s;
        &:hover {
            background: #040f1e;
            color: #e1e1e1;
        }
    }

    .cursor-position {
        font-family: "NotoSans-Regular", sans-serif;
        font-size: 12px;
        color: #7d8799;
        background: transparent;
        border: none;
    }

    .divider {
        position: absolute;
        left: var(--pos);
        width: 2px;
        height: 100%;
        background-color: #313345;
        z-index: 5;
    }

    .footer {
        display: flex;
        align-items: center;
        padding: 0 12px;
        justify-content: space-between;
        width: 100%;
    }
</style>
