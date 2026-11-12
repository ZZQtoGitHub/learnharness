import type { PluginUi, PluginSurfaceTarget, PluginSurfaceProps, PluginWidgetHandle } from "learnharness-plugin-api";
import { Scope, button, element, example, family, note, readout, row } from "./dom.ts";

/** Shared ordinary overlays, always using the real host stack and keyboard policy. */
export function mountOverlayExamples(ui: PluginUi, body: HTMLElement, life: Scope, kind: "menus" | "dialogs"): void {
  let selection: string | null = null;
  let lastCallback = "none";
  let opens = 0;
  const show = readout(body, kind);
  const render = () => show({ selection, opens, lastCallback });
  if (kind === "menus") {
    note(body, "启用与停用的菜单项、本地选择结果，以及首选的展开方向。定位、关闭、Esc 与焦点恢复都由宿主负责。");
    const actions = row(body);
    for (const preferredSide of ["down", "up"] as const) {
      const anchor = example(actions, `menu-${preferredSide}`);
      life.widget(ui.mountButton(anchor, { label: `打开菜单（${preferredSide}）`, variant: "outline", onClick() {
        if (life.signal.aborted) return;
        opens++; lastCallback = `openMenu (${preferredSide})`; render();
        life.widget(ui.openMenu(anchor.querySelector("button") ?? anchor, {
          label: `展示菜单（${preferredSide}）`, preferredSide,
          items: [
            { key: "first", label: "选择第一个示例", onSelect() { selection = "first"; lastCallback = "first.onSelect"; render(); } },
            { key: "disabled", label: "停用示例", disabled: true, onSelect() { throw new Error("停用的菜单项不应被执行"); } },
            { key: "second", label: "选择第二个示例", onSelect() { selection = "second"; lastCallback = "second.onSelect"; render(); } },
          ],
          onClose() { if (!life.signal.aborted) { lastCallback = "menu.onClose"; render(); } },
        }, { signal: life.signal }));
      } }, { signal: life.signal }));
    }
  } else {
    note(body, "普通、长滚动与嵌套三种宿主对话框。被覆盖的父级会保留其本地文本与滚动位置。未安装任何插件键盘处理器或焦点覆盖。");
    const actions = row(body);
    for (const mode of ["ordinary", "long", "nested"] as const) {
      button(ui, actions, life, `dialog-${mode}`, { label: mode === "long" ? "打开长滚动对话框" : mode === "nested" ? "打开嵌套对话框" : "打开普通对话框", variant: "outline", onClick() {
        opens++; lastCallback = `openDialog (${mode})`; render();
        openDialog(ui, life, mode, () => { if (!life.signal.aborted) { lastCallback = `${mode}.onClose`; render(); } });
      } });
    }
  }
  render();
}

function openDialog(ui: PluginUi, owner: Scope, mode: "ordinary" | "long" | "nested", onClose: () => void): void {
  owner.widget(ui.openDialog({
    title: mode === "long" ? "长滚动示例" : mode === "nested" ? "父级对话框示例" : "普通对话框示例",
    content(container, signal) {
      const life = new Scope(signal);
      if (signal.aborted) return life.dispose;
      const root = element("div", undefined, "ui-showcase ui-showcase-overlay");
      root.dataset.showcase = `dialog-${mode}`;
      container.append(root); life.own(() => root.remove());
      note(root, "这是真实宿主对话框内由插件自己负责的内容。用它的关闭按钮或 Esc 关闭。");
      retainedField(ui, root, life, `dialog-${mode}`);
      if (mode === "ordinary") knowledgeExample(ui, root, life, "dialog-ordinary-knowledge");
      if (mode === "long") {
        for (let index = 1; index <= 32; index++) {
          note(root, `第 ${index} 段。这些静态内容让对话框自然产生滚动。滚动位置属于这个已挂载的对话框，打开子级时仍保持不变。`);
        }
      }
      if (mode !== "ordinary") {
        button(ui, root, life, `dialog-${mode}-child`, { label: "打开子级对话框", onClick() { openDialog(ui, life, "ordinary", () => {}); } });
      }
      return life.dispose;
    },
    onClose,
  }, { signal: owner.signal }));
}

function retainedField(ui: PluginUi, root: HTMLElement, life: Scope, id: string): void {
  let value = "保留的本地文本";
  let lastCallback = "none";
  const show = readout(root, id);
  const schema = () => ({ rows: [{ key: "retained", type: "text" as const, label: "保留文本", description: "打开子级前可先修改这里。关闭子级不会重新挂载此字段。", value,
    onChange(next: string) { if (!life.signal.aborted) { value = next; lastCallback = "retained.onChange"; field.update(schema()); render(); } },
  }] });
  const field = life.widget(ui.mountSettingsRows(example(root, `${id}-retained-field`), schema(), { signal: life.signal }));
  function render() { show({ value, lastCallback }); }
  render();
}

function knowledgeExample(ui: PluginUi, root: HTMLElement, life: Scope, id: string): void {
  note(root, "选择结果只保留在本演示中。宿主选择器还提供资料管理操作，那些会影响你的真实资料。");
  let value: readonly string[] = [];
  const show = readout(root, id);
  const picker = life.widget(ui.mountKnowledgePicker(example(root, `${id}-picker`, "知识选择"), {
    value, onChange(next) {
      if (life.signal.aborted) return;
      value = [...next]; picker.update({ value }); show({ value });
    },
  }, { signal: life.signal }));
  show({ value });
}

/** The target is passed through unchanged from the native action context. */
export function openSurfaceDemo(ui: PluginUi, target: PluginSurfaceTarget, signal: AbortSignal, onClose?: () => void): PluginWidgetHandle<PluginSurfaceProps> {
  return openDemo(ui, signal, target, onClose);
}

/** Direct opening captures the current page body through the public host API. */
export function openPageSurfaceDemo(ui: PluginUi, signal: AbortSignal, onClose: () => void): PluginWidgetHandle<PluginSurfaceProps> {
  return openDemo(ui, signal, undefined, onClose);
}

function openDemo(ui: PluginUi, signal: AbortSignal, target?: PluginSurfaceTarget, onClose?: () => void): PluginWidgetHandle<PluginSurfaceProps> {
  const open = (surface: PluginSurfaceProps, lifetime: AbortSignal) => target === undefined
    ? ui.openSurface(surface, { signal: lifetime })
    : ui.openSurface(target, surface, { signal: lifetime });
  let handle: PluginWidgetHandle<PluginSurfaceProps> | undefined;
  handle = open({
    title: "界面展示面板",
    content(container, contentSignal) {
      const scope = new Scope(contentSignal);
      if (contentSignal.aborted) return scope.dispose;
      const root = element("div", undefined, "ui-showcase ui-showcase-surface");
      root.dataset.showcase = "surface";
      container.append(root); scope.own(() => root.remove());
      family(ui, root, scope, "surfaces", "面板示例", (body, life) => {
        note(body, "这个真实的非模态宿主面板覆盖页面主体，只把页面顶栏或悬浮侧边栏控件留在外面，侧边栏与全局对话框仍可用。可见的标题由本插件提供，宿主只提供悬浮关闭按钮和无障碍名称。被嵌套面板覆盖时，本地文本会保留。「重置」会清空本演示的本地示例并恢复变暗背景。");
        retainedField(ui, body, life, "surface-parent");
        knowledgeExample(ui, body, life, "surface-knowledge");
        let opened = 0; let closed = 0; let lastCallback = "none";
        let background: NonNullable<PluginSurfaceProps["background"]> = "dimmed";
        handle?.update({ background });
        const show = readout(body, "surfaces");
        const render = () => show({ background, nestedOpened: opened, nestedClosed: closed, lastCallback });
        const backgrounds = row(body);
        for (const preset of ["dimmed", "opaque"] as const) {
          button(ui, backgrounds, life, `surface-background-${preset}`, { label: `${preset === "dimmed" ? "变暗" : "不透明"}背景`, variant: "outline", onClick() {
            if (life.signal.aborted) return;
            background = preset; handle?.update({ background }); lastCallback = `surface.update (${preset})`; render();
          } });
        }
        button(ui, body, life, "surface-nested", { label: "打开嵌套面板", onClick() {
          if (life.signal.aborted) return;
          opened++; lastCallback = target === undefined ? "openSurface (current page body)" : "openSurface (same opaque native target)"; render();
          life.widget(open({
            title: "嵌套的界面展示面板",
            content(childContainer, childSignal) {
              const child = new Scope(childSignal);
              if (childSignal.aborted) return child.dispose;
              const content = element("div", undefined, "ui-showcase ui-showcase-surface");
              content.dataset.showcase = "surface-nested";
              childContainer.append(content); child.own(() => content.remove());
              note(content, "父级仍挂载在下层。用宿主的关闭按钮或 Esc 关闭本面板，然后查看父级保留的文本。下方的菜单与对话框会打开在本面板之上。");
              retainedField(ui, content, child, "surface-child");
              family(ui, content, child, "menus", "面板上层菜单", (area, lifetime) => mountOverlayExamples(ui, area, lifetime, "menus"));
              family(ui, content, child, "dialogs", "面板上层对话框", (area, lifetime) => mountOverlayExamples(ui, area, lifetime, "dialogs"));
              return child.dispose;
            },
            onClose() { if (!life.signal.aborted) { closed++; lastCallback = "nested surface.onClose"; render(); } },
          }, life.signal));
        } });
        family(ui, body, life, "menus", "面板上层菜单", (area, lifetime) => mountOverlayExamples(ui, area, lifetime, "menus"));
        family(ui, body, life, "dialogs", "面板上层对话框", (area, lifetime) => mountOverlayExamples(ui, area, lifetime, "dialogs"));
        render();
      });
      return scope.dispose;
    },
    onClose,
  }, signal);
  return handle;
}
