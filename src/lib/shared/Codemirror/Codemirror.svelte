<script lang="ts">
    import { onMount } from "svelte";
    import Formatter from "~/utils/Formatter";
    import Converter from "~/utils/Converter";
    import Editor from "~/lib/shared/Codemirror/Editor";
    import Header from "~/lib/shared/Codemirror/components/Header.svelte";
    import Footer from "~/lib/shared/Codemirror/components/Footer.svelte";
    import ErrorModal from "~/lib/shared/Codemirror/components/ErrorModal.svelte";
    import SearchField from "~/lib/shared/Codemirror/components/SearchField.svelte";
    import SettingsModal from "~/lib/shared/Codemirror/components/SettingsModal.svelte";
    import { errorMessage, showError, storageSettings } from "~/storage/store";
    import type { CursorPosition, Formats, SearchData, Tools, UploadEvent } from "~/types";

    interface Props {
        format: Formats;
        placeholder: string;
        label: string;
        tool: Tools;
    }

    let { format, placeholder, label, tool }: Props = $props();

    let codemirror: Editor | undefined = $state();
    let element: HTMLDivElement;
    let value = $state("");
    let isDownloadClicked = $state(false);
    let isCopyClicked = $state(false);
    let cursorPosition: CursorPosition = $state({ line: 0, col: 0 });

    const useTabs = $derived($storageSettings[format].tab || false);
    const indentationLevel = $derived($storageSettings[format].spaces);
    const formatter = $derived(new Formatter(format));

    $effect(() => {
        if (value === "") {
            $showError = false;
            $errorMessage = "";
        }
    });

    const formatAndSet = async (input: string) => {
        const formattedData = await formatter.formatInput(input, useTabs, indentationLevel);
        codemirror?.setFormattingResult(formattedData);
    };

    const handleMainClick = async () => {
        if (tool === "formatter") await formatAndSet(value);
        if (tool === "minifier") {
            const minify = Converter.minify(format);
            if (minify) codemirror?.updateCodemirrorValue(minify(value));
        }
    };

    const handlePaste = async () => {
        await formatAndSet(await Converter.urlToJson(value));
    };

    const readFile = (file: File, delay = 0) => {
        const reader = new FileReader();
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            const data = await Converter.urlToJson(e.target?.result as string);
            codemirror?.updateCodemirrorValue(data);
            setTimeout(() => formatAndSet(data), delay);
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
        isCopyClicked = true;
        setTimeout(() => (isCopyClicked = false), 1000);
        await navigator.clipboard.writeText(value);
    };

    const handleDownloadClick = () => {
        isDownloadClicked = true;
        setTimeout(() => (isDownloadClicked = false), 1000);
        codemirror?.downloadFile(value);
    };

    const performSearch = (searchData: SearchData) => codemirror?.performSearch(searchData);
    const nextSearchValue = () => codemirror?.nextSearchValue();
    const previousSearchValue = () => codemirror?.previousSearchValue();
    const selectAllMatches = () => codemirror?.selectAllMatches();
    const replaceNext = () => codemirror?.replace();
    const replaceAll = () => codemirror?.replaceAll();
    const closeSearch = () => codemirror?.closeSearch();

    onMount(() => {
        const editor = new Editor({
            element,
            outerValueChange: (newValue, newCursorPos) => {
                value = newValue;
                cursorPosition = newCursorPos;
            },
            placeholder,
            label,
            format,
            readOnly: false
        });
        codemirror = editor;

        document.addEventListener("paste", handlePaste);
        document.addEventListener("drop", handleDrop);
        const cmContent = element.querySelector(".cm-content");
        cmContent?.setAttribute("aria-label", `${format.toUpperCase()} input`);

        return () => {
            editor.destroy();
            document.removeEventListener("paste", handlePaste);
            document.removeEventListener("drop", handleDrop);
        };
    });
</script>

<Header formats={[format]} {handleFileChange} {tool} {handleMainClick} {closeSearch} />
<div class="field_wrapper">
    <div class="codemirror-wrapper" bind:this={element}></div>
    <SearchField
        {performSearch}
        {nextSearchValue}
        {previousSearchValue}
        {selectAllMatches}
        {replaceNext}
        {replaceAll}
        {closeSearch}
    />
    <SettingsModal formats={[format]} />
    <ErrorModal />
</div>
<Footer
    {useTabs}
    {indentationLevel}
    {handleCopyClick}
    {handleDownloadClick}
    {isCopyClicked}
    {cursorPosition}
    {isDownloadClicked}
/>

<style lang="scss">
    .codemirror-wrapper {
        height: 60vh;
        background: var(--editor-background, #030711);
    }

    .field_wrapper {
        position: relative;
    }
</style>
