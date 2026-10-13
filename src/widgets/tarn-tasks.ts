/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, svg} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {
  debounce,
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {widgetStyles} from './styles';

interface Task {
  readonly id: string;
  readonly text: string;
}

const MAX_TASKS = 50;
const MAX_LENGTH = 200;
/** A checked task stays this long (click again to undo), then leaves. */
const DONE_MS = 1400;

function normalize(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  const tasks: Task[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const {id, text} = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (typeof text !== 'string') continue;
    seen.add(id);
    tasks.push({id: id.slice(0, 20), text: text.slice(0, MAX_LENGTH)});
    if (tasks.length === MAX_TASKS) break;
  }
  return tasks;
}

const newId = () => Math.random().toString(36).slice(2, 10);

const CHECK = svg`<path d="M5 10.4l3.1 3.1L15 6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * A short to-do list. Type in the top row to add (newest first); the round
 * button on the right checks a task off, and it leaves a moment later. Saved as you type, kept in sync
 * across open tabs.
 */
export class TarnTasks extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    tasks: {state: true},
    done: {state: true},
    fading: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      ul {
        flex: 1;
        min-height: 0;
        margin: 0;
        padding: 0;
        list-style: none;
        overflow-y: auto;
        scrollbar-width: none;
        /* Tasks that run past the tile fade out instead of being cut. */
        mask-image: linear-gradient(
          to bottom,
          #000 calc(100% - 14px),
          transparent
        );
      }

      li {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 28px;
        transition: opacity 300ms ease;
      }

      input {
        flex: 1;
        min-width: 0;
        padding: 0;
        margin: 0;
        font: inherit;
        font-size: 15px;
        line-height: 1.4;
        color: var(--ink);
        text-shadow: inherit;
        background: transparent;
        border: 0;
        outline: none;
        text-overflow: ellipsis;
        transition: color 200ms ease;
      }

      input::placeholder {
        color: var(--ink-faint);
      }

      .check {
        display: grid;
        flex: none;
        place-items: center;
        width: 20px;
        height: 20px;
        padding: 0;
        color: transparent;
        background: transparent;
        border: 1.5px solid var(--ink-faint);
        border-radius: 50%;
        cursor: pointer;
        transition:
          color 150ms ease,
          background-color 150ms ease,
          border-color 150ms ease,
          transform 150ms ease;
      }

      .check svg {
        width: 14px;
        height: 14px;
      }

      .check:hover {
        color: var(--ink-dim);
        border-color: var(--ink-dim);
      }

      .check:active {
        transform: scale(0.9);
      }

      li.done .check {
        color: var(--ink);
        background: var(--chip-strong);
        border-color: transparent;
      }

      li.done input {
        color: var(--ink-dim);
        text-decoration: line-through;
      }

      li.leaving {
        opacity: 0;
      }

      /* The row that adds a task: a faint plus where the button would be. */
      .add::after {
        content: '+';
        display: grid;
        flex: none;
        place-items: center;
        width: 20px;
        font-size: 18px;
        font-weight: 300;
        color: var(--ink-faint);
      }

      @media (prefers-reduced-motion: reduce) {
        li,
        .check {
          transition: none;
        }
      }
    `,
  ];

  declare widgetId: string;
  declare tasks: Task[];
  /** Checked tasks waiting to leave, by id. */
  declare done: ReadonlySet<string>;
  /** Checked tasks fading out right now. */
  declare fading: ReadonlySet<string>;
  private leaving = new Map<string, number>();
  private unwatch: () => void = () => {};
  private save = debounce((tasks: Task[]) => {
    void saveWidgetData(this.widgetId, tasks);
  }, 400);

  constructor() {
    super();
    this.widgetId = '';
    this.tasks = [];
    this.done = new Set();
    this.fading = new Set();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.tasks = peekWidgetData(this.widgetId, normalize);
    void loadWidgetData(this.widgetId, normalize).then(t => (this.tasks = t));
    this.unwatch = watchWidgetData(this.widgetId, normalize, tasks => {
      // Another tab edited the list; don't fight the user typing here.
      if (!this.shadowRoot?.activeElement) this.tasks = tasks;
    });
    window.addEventListener('pagehide', this.save.flush);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const timer of this.leaving.values()) clearTimeout(timer);
    this.leaving.clear();
    this.save.flush();
    this.unwatch();
    window.removeEventListener('pagehide', this.save.flush);
  }

  override render() {
    const full = this.tasks.length >= MAX_TASKS;
    return html`
      <h3 id="title">Tasks</h3>
      <ul aria-labelledby="title">
        ${
          full
            ? ''
            : html`<li class="add">
                <input
                  class="new"
                  aria-label="New task"
                  placeholder="Add a task"
                  maxlength=${MAX_LENGTH}
                  spellcheck="false"
                  @keydown=${this.onNewKey}
                  @blur=${this.onNewBlur}
                />
              </li>`
        }
        ${repeat(
          this.tasks,
          task => task.id,
          task => {
            const done = this.done.has(task.id);
            const fading = this.fading.has(task.id);
            return html`
              <li
                class="${done ? 'done' : ''} ${fading ? 'leaving' : ''}"
                data-id=${task.id}
              >
                <input
                  aria-label="Task"
                  maxlength=${MAX_LENGTH}
                  spellcheck="false"
                  .value=${task.text}
                  @input=${(e: Event) => this.edit(task.id, e)}
                  @keydown=${(e: KeyboardEvent) => this.onTaskKey(task.id, e)}
                  @blur=${this.save.flush}
                />
                <button
                  class="check"
                  aria-label=${done ? 'Not done' : 'Done'}
                  aria-pressed=${done}
                  @click=${() => this.toggle(task.id)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">${CHECK}</svg>
                </button>
              </li>
            `;
          },
        )}
      </ul>
    `;
  }

  private commit(tasks: Task[]): void {
    this.tasks = tasks;
    this.save(tasks);
  }

  private edit(id: string, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.commit(this.tasks.map(t => (t.id === id ? {...t, text} : t)));
  }

  /** Enter jumps to the new-task row; Backspace on an empty task removes it. */
  private onTaskKey(id: string, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.focusRow(null);
    } else if (event.key === 'Backspace' && input.value === '') {
      event.preventDefault();
      const index = this.tasks.findIndex(t => t.id === id);
      this.removeTask(id);
      this.save.flush();
      this.focusRow(this.tasks[index - 1]?.id ?? null);
    }
  }

  private onNewKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addFrom(event.target as HTMLInputElement);
  };

  private onNewBlur = (event: Event) => {
    this.addFrom(event.target as HTMLInputElement);
    this.save.flush();
  };

  private addFrom(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text || this.tasks.length >= MAX_TASKS) return;
    input.value = '';
    // Newest first, right under the row that adds them, so it stays in view.
    this.commit([{id: newId(), text}, ...this.tasks]);
  }

  private async focusRow(id: string | null): Promise<void> {
    await this.updateComplete;
    const selector = id ? `li[data-id="${id}"] input` : 'input.new';
    const input = this.renderRoot.querySelector<HTMLInputElement>(selector);
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }

  /** Checks a task off, or back on while it's still here. */
  private toggle(id: string): void {
    const done = new Set(this.done);
    const timer = this.leaving.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.leaving.delete(id);
      done.delete(id);
      this.done = done;
      return;
    }
    done.add(id);
    this.done = done;
    this.leaving.set(
      id,
      window.setTimeout(() => void this.leave(id), DONE_MS),
    );
  }

  /** Fades the row out, then drops the task. */
  private async leave(id: string): Promise<void> {
    this.fading = new Set(this.fading).add(id);
    await new Promise(r => setTimeout(r, 300));
    this.leaving.delete(id);
    const fading = new Set(this.fading);
    fading.delete(id);
    this.fading = fading;
    this.removeTask(id);
    this.save.flush();
  }

  private removeTask(id: string): void {
    const done = new Set(this.done);
    done.delete(id);
    this.done = done;
    this.commit(this.tasks.filter(t => t.id !== id));
  }
}

customElements.define('tarn-tasks', TarnTasks);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-tasks': TarnTasks;
  }
}
