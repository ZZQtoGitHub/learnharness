import type { PluginTreeProps, PluginTreeRow, PluginUi, PluginUiContent, PluginWidgetHandle } from "learnharness-plugin-api";
import { Scope, button, element, example, note, readout } from "./dom.ts";

/** Synthetic controlled values only; the host owns row presentation and keyboard behavior. */
export function mountTreeDemo(ui: PluginUi, body: HTMLElement, life: Scope): void {
  note(body, "一个使用宿主树组件的小型合成目录。共享条目同时出现在两个文件夹下，各自拥有独立的出现键。选择功能可选，且不会从文件夹级联到子项。隐藏选择不会清空它；「重置」会清空本分区的状态。");
  note(body, "点击某一行，然后用宿主的上下方向键在行间移动；空格键勾选已启用的宿主复选框。可编辑草稿保留其常规输入按键。本示例自带 36rem 最小宽度与横向滚动，不是一套响应式树引擎。");
  let selectionEnabled = false;
  const selectedOccurrenceKeys = new Set<string>();
  const expanded: Record<string, boolean> = { "example-folder": true, "another-folder": true };
  let draft = "本地草稿";
  let lastCallback = "none";
  const show = readout(body, "tree");
  let tree: PluginWidgetHandle<PluginTreeProps>;
  const toggle = button(ui, body, life, "toggle-tree-selection", { label: "启用选择", variant: "outline", onClick() {
    if (life.signal.aborted) return;
    selectionEnabled = !selectionEnabled;
    lastCallback = selectionEnabled ? "selection enabled" : "selection disabled";
    render();
  } });

  // One factory per family lifetime: controlled updates retain this content's
  // DOM, while disclosure unmounts it and a later mount restores the local draft.
  const draftContent: PluginUiContent = (container, signal) => {
    const content = new Scope(signal);
    if (life.signal.aborted || content.signal.aborted) { content.dispose(); return content.dispose; }
    const root = element("div");
    root.append(element("div", "草稿笔记", "ui-showcase-label font-ui text-xs"));
    const input = element("input", undefined, "font-ui text-sm");
    input.type = "text";
    input.setAttribute("aria-label", "目录草稿");
    input.value = draft;
    const change = () => {
      if (life.signal.aborted || content.signal.aborted) return;
      draft = input.value; lastCallback = "draft.onInput"; render();
    };
    input.addEventListener("input", change);
    root.append(input); container.append(root);
    content.own(() => { input.removeEventListener("input", change); root.remove(); });
    return content.dispose;
  };
  const selection = (key: string, label: string): Pick<PluginTreeRow, "selection"> => selectionEnabled ? { selection: {
    label, checked: selectedOccurrenceKeys.has(key), onChange(value) {
      if (life.signal.aborted || !selectionEnabled) return;
      if (value) selectedOccurrenceKeys.add(key); else selectedOccurrenceKeys.delete(key);
      lastCallback = `selection.onChange: ${key}`; render();
    },
  } } : {};
  const folder = (key: string, title: string, children: readonly PluginTreeRow[]): PluginTreeRow => ({
    key, content: title, cells: { kind: "Folder", state: expanded[key] ? "Expanded" : "Collapsed" }, children,
    ...selection(key, `选择${title}`),
    disclosure: { label: `切换${title}`, expanded: expanded[key]!, onChange(value) {
      if (life.signal.aborted) return;
      expanded[key] = value; lastCallback = `disclosure.onChange: ${key}`; render();
    } },
  });
  const rows = (): PluginTreeRow[] => [
    folder("example-folder", "示例文件夹", [
      { key: "example-folder/shared-item", content: "共享条目", cells: { kind: "笔记", state: "重复" }, ...selection("example-folder/shared-item", "在示例文件夹中选择共享条目") },
      { key: "example-folder/draft-note", content: draftContent, cells: { kind: "草稿", state: "可编辑" }, ...selection("example-folder/draft-note", "选择草稿笔记") },
    ]),
    folder("another-folder", "另一个文件夹", [
      { key: "another-folder/shared-item", content: "共享条目", cells: { kind: "笔记", state: "重复" }, ...selection("another-folder/shared-item", "在另一个文件夹中选择共享条目") },
    ]),
  ];
  const viewport = example(body, "tree");
  viewport.style.overflowX = "auto";
  const minimum = element("div"); minimum.style.minWidth = "36rem";
  viewport.append(minimum);
  tree = life.widget(ui.mountTree(minimum, {
    label: "目录示例", header: "名称", rows: rows(), columns: [
      { key: "kind", header: "Kind", width: 56 },
      { key: "state", header: "State", width: 80 },
    ],
  }, { signal: life.signal }));
  function render() {
    tree.update({ rows: rows() });
    toggle.update({ label: selectionEnabled ? "停用选择" : "启用选择" });
    show({ selectionEnabled, selectedOccurrenceKeys: [...selectedOccurrenceKeys], expanded: { ...expanded }, draft, lastCallback });
  }
  render();
}
