import type {
  PluginFrontendContext, PluginModelValue, PluginThinkingPickerProps, PluginStandardComposerProps,
  PluginSettingsSchema, PluginWidgetHandle,
  PluginThinkingPickerProps as ThinkingProps, PluginButtonProps,
} from "learnharness-plugin-api";
import { Scope, button, element, example, family, note, readout, row } from "./dom.ts";
import { mountOverlayExamples, openPageSurfaceDemo } from "./surfaces.ts";
import { mountTreeDemo } from "./tree.ts";

type Thinking = PluginThinkingPickerProps["value"];
export const FAMILY_IDS = ["pickers", "composer", "dictation", "standard-composer", "buttons", "settings", "markdown", "tree", "worker-results", "menus", "dialogs", "surfaces"] as const;

export function mountGallery(container: HTMLElement, ctx: PluginFrontendContext, signal: AbortSignal): () => void {
  const scope = new Scope(signal);
  if (signal.aborted) return scope.dispose;
  const root = element("div", undefined, "ui-showcase");
  root.dataset.showcase = "gallery";
  container.append(root);
  scope.own(() => root.remove());
  note(root, "宿主界面示例。各数值与回调读数只属于本视图，离开后即重置。「发送」和「中止」只模拟本地状态，不会调用模型。听写是真实功能，仅在明确启动时才使用你已配置的语音服务商。");
  const ui = ctx.ui;

  family(ui, root, scope, "pickers", "选择器", (body, life) => {
    note(body, "模型与思考档位控件使用宿主真实的目录。两者的联动选择只保留在本分区内，不会改动核心默认值。");
    let model: PluginModelValue | undefined;
    let thinking: Thinking;
    let lastCallback = "none";
    const show = readout(body, "pickers");
    let thinkingPicker: PluginWidgetHandle<ThinkingProps>;
    const modelPicker = life.widget(ui.mountModelPicker(example(body, "model-picker", "模型"), {
      value: model, onChange(value) {
        if (life.signal.aborted) return;
        model = value; thinking = undefined; lastCallback = "model.onChange (thinking cleared)";
        modelPicker.update({ value: model });
        thinkingPicker.update({ model, value: thinking }); render();
      },
    }, { signal: life.signal }));
    thinkingPicker = life.widget(ui.mountThinkingPicker(example(body, "thinking-picker", "此模型的思考档位"), {
      model, value: thinking, onChange(value) {
        if (life.signal.aborted) return;
        thinking = value; lastCallback = "thinking.onChange";
        thinkingPicker.update({ value }); render();
      },
    }, { signal: life.signal }));
    let knowledge: readonly string[] = [];
    note(body, "选择结果只保留在本演示中。宿主选择器还提供资料管理操作，那些会影响你的真实资料。");
    const knowledgePicker = life.widget(ui.mountKnowledgePicker(example(body, "knowledge-picker", "知识选择"), {
      value: knowledge, onChange(value) {
        if (life.signal.aborted) return;
        knowledge = [...value]; lastCallback = "knowledge.onChange";
        knowledgePicker.update({ value: knowledge }); render();
      },
    }, { signal: life.signal }));
    function render() { show({ model: model ?? null, thinking: thinking ?? null, knowledge, lastCallback }); }
    render();
  });

  family(ui, root, scope, "composer", "输入框", (body, life) => {
    note(body, "点击「发送」会进入本地忙碌状态并保留草稿。忙碌且草稿非空时，宿主仍保留「发送」以便插话引导。清空草稿即可显示「中止」；也可以使用「完成模拟」，它在整个忙碌状态期间都可用。不会发送或保存任何内容。");
    let value = ""; let busy = false; let sends = 0; let lastCallback = "none";
    const show = readout(body, "composer");
    const composer = life.widget(ui.mountComposer(example(body, "composer", "独立输入框"), {
      value, placeholder: "输入本地草稿", autoFocus: false, canSend: false,
      onChange(next) { if (!life.signal.aborted) { value = next; lastCallback = "onChange"; render(); } },
      onSend() { if (!life.signal.aborted && value.trim()) { busy = true; sends++; lastCallback = "onSend (local simulation)"; render(); } },
      onStop() { if (!life.signal.aborted) { busy = false; lastCallback = "onStop (local simulation)"; render(); } },
    }, { signal: life.signal }));
    const complete = button(ui, body, life, "complete-composer", { label: "完成模拟", disabled: true, variant: "outline", onClick() { busy = false; lastCallback = "simulation completed"; render(); } });
    function render() { composer.update({ value, busy, canSend: !!value.trim() }); complete.update({ disabled: !busy }); show({ draft: value, busy, sends, lastCallback }); }
    render();
  });

  family(ui, root, scope, "dictation", "听写", (body, life) => {
    note(body, "真实听写：只有明确选择「听写」或麦克风时，才会使用你已配置的语音服务商。这会把音频发给该服务商，可能产生费用。不会自动启动。「结束」会等待最终转写送达；「取消」只影响本控件的录音，不影响其他使用方。");
    let transcript = ""; let deliveries = 0; let lastCallback = "none";
    const show = readout(body, "dictation");
    const dictation = ui.mountDictation(example(body, "dictation", "宿主听写控件"), {
      onTranscript(text) { if (!life.signal.aborted) { transcript = join(transcript, text); deliveries++; lastCallback = "onTranscript"; render(); } },
    }, { signal: life.signal });
    life.own(() => dictation.dispose());
    const controls = row(body);
    button(ui, controls, life, "dictate", { label: "听写", onClick() { lastCallback = "toggle requested (not recording status)"; render(); dictation.toggle(); } });
    button(ui, controls, life, "finish-dictation", { label: "结束听写", variant: "outline", async onClick() {
      await dictation.finish();
      if (!life.signal.aborted) { lastCallback = "finish resolved after final delivery"; render(); }
    } });
    button(ui, controls, life, "cancel-dictation", { label: "取消听写", variant: "outline", onClick() { dictation.cancel(); lastCallback = "cancel requested"; render(); } });
    function render() { show({ transcript, deliveries, lastCallback }); }
    render();
  });

  family(ui, root, scope, "standard-composer", "标准输入框", (body, life) => {
    note(body, "独立的本地模型、思考档位与草稿状态。「发送」会先通过宿主 API 等待听写的最终转写送达，再进行本次本地模拟，并保留你的草稿。忙碌且草稿非空时，宿主仍保留「发送」以便插话引导。清空草稿即可显示「中止」；也可以使用「完成模拟」，它在整个忙碌状态期间都可用。麦克风会明确启动真实听写，使用你已配置的语音服务商，可能发送音频并产生费用。");
    let value = ""; let model: PluginModelValue | undefined; let thinking: Thinking;
    let busy = false; let sends = 0; let deliveries = 0; let lastCallback = "none"; let lastSent = "";
    const show = readout(body, "standard-composer");
    let composer: PluginWidgetHandle<PluginStandardComposerProps>;
    let complete: PluginWidgetHandle<PluginButtonProps>;
    const props = (): PluginStandardComposerProps => ({
      composer: {
        value, busy, autoFocus: false, placeholder: "独立的本地草稿",
        onChange(next) { if (!life.signal.aborted) { value = next; lastCallback = "composer.onChange"; render(); } },
        onSend() { if (!life.signal.aborted && value.trim()) { lastSent = value; busy = true; sends++; lastCallback = "composer.onSend (after final dictation; local simulation)"; render(); } },
        onStop() { if (!life.signal.aborted) { busy = false; lastCallback = "composer.onStop (local simulation)"; render(); } },
      },
      model: { value: model, onChange(next) { if (!life.signal.aborted) { model = next; thinking = undefined; lastCallback = "model.onChange (thinking cleared)"; render(); } } },
      thinking: { model, value: thinking, onChange(next) { if (!life.signal.aborted) { thinking = next; lastCallback = "thinking.onChange"; render(); } } },
      dictation: { onTranscript(text) { if (!life.signal.aborted) { value = join(value, text); deliveries++; lastCallback = "dictation.onTranscript (draft updated)"; render(); } } },
    });
    composer = life.widget(ui.mountStandardComposer(example(body, "standard-composer", "宿主标准输入框"), props(), { signal: life.signal }));
    complete = button(ui, body, life, "complete-standard-composer", { label: "完成模拟", variant: "outline", disabled: true, onClick() { busy = false; lastCallback = "simulation completed"; render(); } });
    function render() { composer.update(props()); complete.update({ disabled: !busy }); show({ draft: value, model: model ?? null, thinking: thinking ?? null, busy, sends, deliveries, lastSent, lastCallback }); }
    render();
  });

  family(ui, root, scope, "buttons", "按钮", (body, life) => {
    note(body, "异步回调等待期间，宿主按钮目前不会自动显示等待中或已停用的样式。本示例的等待中读数与「完成异步示例」控件都由演示自身维护。");
    let clicks = 0; let lastCallback = "none"; let pending: (() => void) | undefined;
    const show = readout(body, "buttons");
    const variants = row(body);
    for (const variant of ["default", "destructive", "outline", "secondary", "ghost", "link"] as const) {
      button(ui, variants, life, `button-variant-${variant}`, { label: variant, variant, onClick() { clicks++; lastCallback = `variant: ${variant}`; render(); } });
    }
    const sizes = row(body);
    for (const size of ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      const icon = size.startsWith("icon");
      const slot = example(sizes, `button-size-${size}`, size);
      life.widget(ui.mountButton(slot, { label: icon ? "+" : size, title: icon ? `添加示例（${size}）` : `${size} 尺寸`, size, variant: "outline", onClick() { clicks++; lastCallback = `size: ${size}`; render(); } }, { signal: life.signal }));
    }
    note(body, "标记使用插件提供的文字和单一颜色，背景为 15% 淡化。这些是静态示例，不是评分结果。");
    const badges = row(body);
    for (const [id, props] of [
      ["neutral", { text: "中性" }],
      ["green", { text: "测试通过", color: "#22c55e" }],
      ["red", { text: "测试未通过", color: "#ef4444" }],
      ["amber", { text: "含提示", color: "#f59e0b" }],
    ] as const) {
      life.widget(ui.mountBadge(example(badges, `badge-${id}`), props, { signal: life.signal }));
    }
    button(ui, body, life, "button-disabled", { label: "已停用", disabled: true, onClick() { throw new Error("停用示例不应被执行"); } });
    const actions = row(body);
    button(ui, actions, life, "button-async", { label: "启动异步示例", onClick() {
      if (pending || life.signal.aborted) return;
      lastCallback = "async callback pending";
      const promise = new Promise<void>(resolve => { pending = resolve; });
      render();
      return promise;
    } });
    const complete = button(ui, actions, life, "complete-button-async", { label: "完成异步示例", variant: "outline", disabled: true, onClick() { finish(); lastCallback = "async callback completed"; render(); } });
    function finish() { const resolve = pending; pending = undefined; resolve?.(); }
    life.own(finish);
    function render() { complete.update({ disabled: !pending }); show({ clicks, pending: !!pending, lastCallback }); }
    render();
  });

  family(ui, root, scope, "settings", "设置项", (body, life) => {
    note(body, "所有数值都只保留在本地。文本至少包含三个非空白字符，数字与滑块必须是其显示范围内的整数。无效编辑会在 onChange 之前被宿主拒绝。");
    let enabled = true; let text = "Example"; let choice = "first"; let count = 3; let amount = 50; let lastCallback = "none";
    const show = readout(body, "settings");
    const update = (key: string, apply: () => void) => { if (!life.signal.aborted) { apply(); lastCallback = `${key}.onChange`; render(); } };
    const schema = (): PluginSettingsSchema => ({ rows: [
      { key: "toggle", type: "toggle", label: "开关示例", description: "一个本地布尔值。", value: enabled, onChange: value => update("toggle", () => { enabled = value; }) },
      { key: "text", type: "text", label: "文本示例", description: "至少三个非空白字符。", value: text, validate: value => value.trim().length < 3 ? "请输入至少三个非空白字符。" : undefined, onChange: value => update("text", () => { text = value; }) },
      { key: "dropdown", type: "dropdown", label: "下拉示例", description: "从两个本地选项中择一。", value: choice, options: [{ value: "first", label: "第一个选项" }, { value: "second", label: "第二个选项" }], onChange: value => update("dropdown", () => { choice = value; }) },
      { key: "number", type: "number", label: "数字示例", description: "1 到 10 之间的整数。", value: count, min: 1, max: 10, step: 1, validate: value => Number.isInteger(value) ? undefined : "请输入整数。", onChange: value => update("number", () => { count = value; }) },
      { key: "slider", type: "slider", label: "滑块示例", description: "0 到 100 之间的整数。", value: amount, min: 0, max: 100, step: 1, validate: value => Number.isInteger(value) ? undefined : "请选择整数。", onChange: value => update("slider", () => { amount = value; }) },
      { key: "disabled", type: "text", label: "停用示例", description: "此行不可编辑。", value: "不可用", disabled: true, onChange() {} },
    ] });
    const settings = life.widget(ui.mountSettingsRows(example(body, "settings-rows"), schema(), { signal: life.signal }));
    function render() { settings.update(schema()); show({ enabled, text, choice, count, amount, lastCallback }); }
    render();
  });

  family(ui, root, scope, "markdown", "Markdown 渲染", (body, life) => {
    note(body, "宿主静态渲染：段落、代码、表格、数学公式与 Mermaid。不使用图片、远程资源或模型调用。");
    life.widget(ui.mountMarkdown(example(body, "markdown"), { text: MARKDOWN }, { signal: life.signal }));
    readout(body, "markdown")({ mode: "static", lastCallback: "none" });
  });

  family(ui, root, scope, "tree", "目录 / 树", (body, life) => mountTreeDemo(ui, body, life));

  family(ui, root, scope, "worker-results", "工作进程结果", (body, life) => {
    note(body, "十二个静态示例：四种终止状态与三种呈现方式的全部组合。不会启动任何工作进程。");
    for (const status of ["succeeded", "failed", "cancelled", "interrupted"] as const) {
      for (const presentation of ["collapsed", "card", "plain"] as const) {
        life.widget(ui.mountWorkerResult(example(body, `worker-${status}-${presentation}`, `${status} / ${presentation}`), {
          label: "示例工作进程", status, presentation,
          text: `**静态示例：** ${status}。未运行工作进程。`,
        }, { signal: life.signal }));
      }
    }
    readout(body, "worker-results")({ examples: 12, workersStarted: 0, lastCallback: "none" });
  });

  family(ui, root, scope, "menus", "菜单", (body, life) => mountOverlayExamples(ui, body, life, "menus"));
  family(ui, root, scope, "dialogs", "对话框", (body, life) => mountOverlayExamples(ui, body, life, "dialogs"));
  family(ui, root, scope, "surfaces", "面板", (body, life) => {
    note(body, "在当前页面上方打开一个非模态宿主面板。它的页面顶栏或悬浮侧边栏控件留在面板之外，侧边栏与全局对话框仍可用。离开当前页面即关闭该面板。");
    note(body, "同一个演示也可以在原生教学或练习会话的「界面展示」面板顶栏操作中打开。两者都包含背景预设、保留文本、嵌套面板，以及面板上层的菜单与对话框。Esc 与焦点始终由宿主完全掌控。");
    let opens = 0; let closed = 0; let lastCallback = "none";
    const show = readout(body, "surfaces");
    const render = () => show({ target: "current page", opens, closed, lastCallback });
    button(ui, body, life, "open-surface", { label: "打开面板", variant: "outline", onClick() {
      if (life.signal.aborted) return;
      opens++; lastCallback = "openSurface (current page body)"; render();
      life.widget(openPageSurfaceDemo(ui, life.signal, () => {
        if (life.signal.aborted) return;
        closed++; lastCallback = "surface.onClose"; render();
      }));
    } });
    render();
  });
  return scope.dispose;
}

function join(current: string, text: string): string { return current ? `${current}\n${text}` : text; }

const MARKDOWN = `A **host-rendered** paragraph with *emphasis*, inline \`code\`, and a short list:

- Complete static content
- Built-in renderers only

\`\`\`ts
const message: string = "Hello, gallery";
console.log(message);
\`\`\`

| Example | Value |
| --- | --- |
| Local state | Ephemeral |
| Model calls | None |

Inline math: $a^2 + b^2 = c^2$.

$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

\`\`\`mermaid
flowchart LR
  A[Local input] --> B[Host widget]
  B --> C[Local callback]
\`\`\`
`;
