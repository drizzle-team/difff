<script lang="ts">
    import { onMount } from "svelte";
    import Header from "~/lib/shared/Codemirror/components/Header.svelte";
    import ErrorModal from "~/lib/shared/Codemirror/components/ErrorModal.svelte";
    import SettingsModal from "~/lib/shared/Codemirror/components/SettingsModal.svelte";
    import DoubleFooter from "~/lib/shared/Codemirror/components/DoubleFooter.svelte";
    import SearchField from "~/lib/shared/Codemirror/components/SearchField.svelte";
    import {
        errorMessage,
        isSearchOpen,
        isSettingsOpen,
        showError,
        storageSettings
    } from "~/storage/store";
    import type { CursorPosition, Formats, SearchData, UploadEvent } from "~/types";
    import Editor from "~/lib/shared/Codemirror/Editor";
    import Formatter from "~/utils/Formatter";
    import Converter, { type ConversionName } from "~/utils/Converter";

    interface Props {
        formatLeft: Formats;
        formatRight: Formats;
        placeholderLeft: string;
        placeholderRight: string;
        /** Name of the Converter method; islands can only receive serializable props. */
        convert: ConversionName;
        labelLeft: string;
        labelRight: string;
    }

    let {
        formatLeft,
        formatRight,
        placeholderLeft,
        placeholderRight,
        convert,
        labelLeft,
        labelRight
    }: Props = $props();

    let wrapper: HTMLDivElement;
    let elementLeft: HTMLDivElement;
    let elementRight: HTMLDivElement;
    let codemirrorLeft: Editor | undefined = $state();
    let codemirrorRight: Editor | undefined = $state();
    let valueLeft = $state("");
    let valueRight = $state("");
    let cursorPositionLeft: CursorPosition = $state({ line: 0, col: 0 });
    let cursorPositionRight: CursorPosition = $state({ line: 0, col: 0 });

    let dividerPos = $state(50);
    let isDownloadClicked = $state(false);
    let isCopyClicked = $state(false);
    let isFormatClicked = $state(false);
    let isClearClicked = $state(false);

    const useTabsLeft = $derived($storageSettings[formatLeft].tab || false);
    const indentationLevelLeft = $derived($storageSettings[formatLeft].spaces);
    const useTabsRight = $derived($storageSettings[formatRight].tab || false);
    const indentationLevelRight = $derived($storageSettings[formatRight].spaces);

    const formatterLeft = new Formatter(formatLeft);
    const formatterRight = new Formatter(formatRight);

    $effect(() => {
        if (valueLeft === "") {
            $showError = false;
            $errorMessage = "";
        }
    });

    const flash = (set: (v: boolean) => void) => {
        set(true);
        setTimeout(() => set(false), 1000);
    };

    const formatLeftAndSet = async (input: string) => {
        const formatted = await formatterLeft.formatInput(input, useTabsLeft, indentationLevelLeft);
        codemirrorLeft?.setFormattingResult(formatted);
    };

    const handleMainClick = async () => {
        const converted = Converter[convert](valueLeft);
        const formatted = await formatterRight.formatInput(
            converted,
            useTabsRight,
            indentationLevelRight
        );
        codemirrorRight?.setFormattingResult(formatted);
    };

    const handleFormatClick = async () => {
        flash((v) => (isFormatClicked = v));
        await formatLeftAndSet(valueLeft);
    };

    const handleClearClick = () => {
        flash((v) => (isClearClicked = v));
        codemirrorLeft?.updateCodemirrorValue("");
        codemirrorRight?.updateCodemirrorValue("");
    };

    const handlePaste = async () => {
        await formatLeftAndSet(await Converter.urlToJson(valueLeft));
    };

    const readFile = (file: File, delay = 0) => {
        const reader = new FileReader();
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            const data = await Converter.urlToJson(e.target?.result as string);
            codemirrorLeft?.updateCodemirrorValue(data);
            setTimeout(() => formatLeftAndSet(data), delay);
        };
        reader.readAsText(file);
    };

    const handleDrop = (event: DragEvent) => {
        event.preventDefault();
        const file = event.dataTransfer?.files[0];
        if (file) readFile(file);
    };

    const handleFileChange = (event: UploadEvent) => {
        event.preventDefault();
        const file = event.currentTarget.files?.[0];
        if (file) readFile(file, 10);
    };

    const handleCopyClick = async () => {
        flash((v) => (isCopyClicked = v));
        await navigator.clipboard.writeText(valueRight);
    };

    const handleDownloadClick = () => {
        flash((v) => (isDownloadClicked = v));
        codemirrorRight?.downloadFile(valueRight);
    };

    const handleDividerMove = (event: MouseEvent) => {
        const rect = wrapper.getBoundingClientRect();
        const newX = ((event.clientX - rect.left) / rect.width) * 100;
        dividerPos = Math.max(20, Math.min(newX, 82));
    };

    const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleDividerMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
    };

    const handleMouseDown = () => {
        window.addEventListener("mousemove", handleDividerMove);
        window.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "ew-resize";
    };

    const performSearch = (searchData: SearchData) => codemirrorLeft?.performSearch(searchData);
    const nextSearchValue = () => codemirrorLeft?.nextSearchValue();
    const previousSearchValue = () => codemirrorLeft?.previousSearchValue();
    const selectAllMatches = () => codemirrorLeft?.selectAllMatches();
    const replaceNext = () => codemirrorLeft?.replace();
    const replaceAll = () => codemirrorLeft?.replaceAll();
    const closeSearch = () => codemirrorLeft?.closeSearch();

    onMount(() => {
        const left = new Editor({
            element: elementLeft,
            outerValueChange: (newValue, newCursorPos) => {
                valueLeft = newValue;
                cursorPositionLeft = newCursorPos;
            },
            placeholder: placeholderLeft,
            label: labelLeft,
            format: formatLeft,
            readOnly: false
        });
        const right = new Editor({
            element: elementRight,
            outerValueChange: (newValue, newCursorPos) => {
                valueRight = newValue;
                cursorPositionRight = newCursorPos;
            },
            placeholder: placeholderRight,
            label: labelRight,
            format: formatRight,
            readOnly: true
        });
        codemirrorLeft = left;
        codemirrorRight = right;

        document.addEventListener("paste", handlePaste);
        document.addEventListener("drop", handleDrop);
        elementLeft
            .querySelector(".cm-content")
            ?.setAttribute("aria-label", `${formatLeft.toUpperCase()} input`);

        return () => {
            left.destroy();
            right.destroy();
            handleMouseUp();
            document.removeEventListener("paste", handlePaste);
            document.removeEventListener("drop", handleDrop);
        };
    });
</script>

<Header
    formats={[formatLeft, formatRight]}
    {handleFileChange}
    tool="converter"
    {handleMainClick}
    {closeSearch}
/>
<div class="double_field_wrapper" bind:this={wrapper} style={`--pos: ${dividerPos}%;`}>
    <div class="field_wrapper">
        <div class="codemirror-wrapper" bind:this={elementLeft}></div>
        {#if $isSearchOpen}
            <SearchField
                {performSearch}
                {nextSearchValue}
                {previousSearchValue}
                {selectAllMatches}
                {replaceNext}
                {replaceAll}
                {closeSearch}
            />
        {/if}
        {#if $showError}
            <ErrorModal />
        {/if}
    </div>
    <div
        onmousedown={handleMouseDown}
        aria-labelledby="Windows divider"
        aria-label="Windows divider"
        class="divider"
        role="button"
        tabindex="0"
    ></div>
    <div class="field_wrapper">
        {#if $isSettingsOpen}
            <SettingsModal formats={[formatLeft, formatRight]} />
        {/if}
        <div class="codemirror-wrapper" bind:this={elementRight}></div>
    </div>
</div>

<DoubleFooter
    {dividerPos}
    {formatLeft}
    {cursorPositionLeft}
    {formatRight}
    {cursorPositionRight}
    {handleFormatClick}
    {handleCopyClick}
    {handleDownloadClick}
    {handleClearClick}
    {isCopyClicked}
    {isDownloadClicked}
    {isFormatClicked}
    {isClearClicked}
/>

<style lang="scss">
    .codemirror-wrapper {
        height: 60vh;
        background: var(--editor-background, #030711);
    }

    .field_wrapper {
        width: 100%;
        height: 100%;
        overflow: auto;
        position: relative;
    }

    .divider {
        position: absolute;
        z-index: 5;
        display: flex;
        justify-content: center;
        align-items: center;
        left: var(--pos);
        width: 2px;
        height: 100%;
        background: #313345;
        cursor: ew-resize;
        &:hover {
            width: 2px;
            background: #525675;
        }
    }

    .double_field_wrapper {
        position: relative;
        display: grid;
        grid-template-columns: var(--pos) 1fr;
    }
</style>
