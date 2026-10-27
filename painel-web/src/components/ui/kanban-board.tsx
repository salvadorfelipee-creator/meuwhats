import * as React from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { CalendarDays, Flag, Plus, Pencil, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   KanbanBoard

   Board genérico de colunas com arraste — adaptado do componente "Kanban
   Board" do 21st.dev (Mohamed Uvaish / layro.vercel.app), colado aqui pelo
   usuário como referência de design e interação. Mantém a base (drag por
   pointer events puro, sem lib de DnD; placeholder que abre vaga; spring
   physics; teclado completo; scroll rail própria) e adiciona duas coisas que
   o original não tinha: um clique simples (sem arrastar) dispara
   `onTaskClick` em vez de só soltar o card no lugar, e os botões de coluna
   ("..." e "Add task") só aparecem se o chamador passar um callback — um
   botão visível que não faz nada é pior do que não ter o botão.

   Este arquivo é genérico de propósito (não sabe o que é "conversa" ou
   "pipeline de empréstimo") — quem usa decide o que cada card representa.
   ========================================================================== */

const SQUIRCLE = "[corner-shape:squircle]";

const FONT_STACK =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const CHIP = "inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] leading-none";
const PILL = "inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium leading-none";

const GAP = 8;

const LIFT_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
const FLOW_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

/** Distância em px que o pointer precisa percorrer pra virar arraste — abaixo disso, vira clique. */
const DRAG_THRESHOLD = 5;

export type Priority = "urgent" | "high" | "normal" | "low";

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: "bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300",
  normal: "bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300",
  low: "bg-neutral-100 text-neutral-500 dark:bg-white/[0.07] dark:text-neutral-400",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Prioridade",
  normal: "Normal",
  low: "Baixa",
};

export type Accent = "slate" | "violet" | "blue" | "amber" | "emerald" | "rose";

const ACCENT_DOT: Record<Accent, string> = {
  slate: "bg-neutral-400",
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
};

export interface KanbanPerson {
  name: string;
  avatar?: string;
  /** Cor de fundo pras iniciais quando não há avatar (senão usa hash do nome). */
  color?: string;
}

export interface KanbanTag {
  id: string | number;
  nome: string;
  cor: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  note?: string;
  priority?: Priority;
  tags?: KanbanTag[];
  people?: KanbanPerson[];
  /** Texto curto, ex. "5min", "Ontem". */
  due?: string;
  /** Pinta a data em âmbar — use pra "precisa de atenção". */
  dueSoon?: boolean;
  /** Pinta o cartão inteiro (fundo + borda âmbar) — "parado há muito tempo nessa etapa". */
  stale?: boolean;
  /** Conversa não lida — mostra uma bolinha vermelha ao lado do título. */
  unread?: boolean;
  /** Com `unread`, pisca (ping) em vez de ficar sólida — "urgente" pra quem está vendo o quadro. */
  unreadBlink?: boolean;
  /** Cliente recebeu o link de autorização e ainda não autorizou: cartão pisca em laranja. */
  authBlink?: boolean;
  channelKind?: "whatsapp" | "instagram" | "site";
}

export interface KanbanColumn {
  id: string;
  name: string;
  accent?: Accent;
  /** Cor exata (hex) da bolinha de status — tem prioridade sobre `accent` quando os dois vêm. */
  dotColor?: string;
  /** Texto curto à direita do cabeçalho da coluna, ex. soma de valores ("R$ 9.800"). */
  subtitle?: string;
  /** Nota informativa no rodapé da coluna (ex. "⚡ Avisa se parado..."). */
  footerNote?: string;
  /** Quando presente, `footerNote` vira clicável (botão + ícone de lápis) — usado pelo Pipeline
   * pra editar o limiar de alerta "parado na etapa" direto ali. */
  onFooterNoteClick?: () => void;
  tasks: KanbanTask[];
}

export interface KanbanBoardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "onChange"
  > {
  columns: KanbanColumn[];
  onChange?: (columns: KanbanColumn[]) => void;
  /** Clique sem arrastar num card. */
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (colId: string) => void;
  label?: string;
}

type DragState = {
  taskId: string;
  fromCol: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  startClientX: number;
  startClientY: number;
};

type Slot = { col: string; index: number };

export const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(
  function KanbanBoard(
    { columns, onChange, onTaskClick, onAddTask, label = "Quadro", className, style, ...props },
    ref,
  ) {
    const [cols, setCols] = React.useState<KanbanColumn[]>(columns);
    const [drag, setDrag] = React.useState<DragState | null>(null);
    const [slot, setSlot] = React.useState<Slot | null>(null);
    const [grabbed, setGrabbed] = React.useState<string | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const [atStart, setAtStart] = React.useState(true);
    const [atEnd, setAtEnd] = React.useState(true);
    const reduceMotion = useReducedMotion();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const trackRef = React.useRef<HTMLDivElement>(null);
    const listRefs = React.useRef(new Map<string, HTMLDivElement>());
    const colRefs = React.useRef(new Map<string, HTMLDivElement>());
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>());
    const dragRef = React.useRef<DragState | null>(null);
    const slotRef = React.useRef<Slot | null>(null);
    const autoScroll = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => setCols(columns), [columns]);

    const syncEdges = React.useCallback(() => {
      const el = trackRef.current;
      if (!el) return;
      setAtStart(el.scrollLeft < 8);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
    }, []);

    React.useEffect(() => {
      syncEdges();
      const el = trackRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncEdges);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncEdges, cols.length]);

    const fade = "24px";
    const maskStops = [
      `transparent 0%, #000 ${atStart ? "0%" : fade}`,
      `#000 ${atEnd ? "100%" : `calc(100% - ${fade})`}, transparent 100%`,
    ].join(", ");
    const mask = atStart && atEnd ? undefined : `linear-gradient(to right, ${maskStops})`;

    React.useEffect(() => {
      if (!grabbed) return;
      const el = cardRefs.current.get(grabbed);
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }, [cols, grabbed]);

    const locate = React.useCallback((list: KanbanColumn[], taskId: string) => {
      for (const c of list) {
        const i = c.tasks.findIndex((t) => t.id === taskId);
        if (i > -1) return { col: c.id, index: i, task: c.tasks[i] };
      }
      return null;
    }, []);

    const move = React.useCallback(
      (taskId: string, to: Slot) => {
        setCols((prev) => {
          const found = locate(prev, taskId);
          if (!found) return prev;
          if (found.col === to.col && found.index === to.index) return prev;

          const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
          const from = next.find((c) => c.id === found.col)!;
          from.tasks.splice(found.index, 1);
          const dest = next.find((c) => c.id === to.col)!;
          dest.tasks.splice(Math.min(to.index, dest.tasks.length), 0, found.task);

          onChange?.(next);
          return next;
        });
      },
      [locate, onChange],
    );

    const snapRef = React.useRef(new Map<string, number[]>());

    const snapshot = React.useCallback((taskId: string, fromCol: string) => {
      const map = new Map<string, number[]>();
      listRefs.current.forEach((list, colId) => {
        const listTop = list.getBoundingClientRect().top;
        const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-kanban-card]"));
        let removed = -1;
        let removedH = 0;
        const rows = cards.map((el, i) => {
          const r = el.getBoundingClientRect();
          const isDragged = colId === fromCol && el.dataset.kanbanCard === taskId;
          if (isDragged) {
            removed = i;
            removedH = r.height;
          }
          return { top: r.top - listTop, h: r.height, isDragged };
        });
        const mids = rows
          .filter((row) => !row.isDragged)
          .map((row, i) => {
            const shift = removed > -1 && i >= removed ? removedH + GAP : 0;
            return row.top - shift + row.h / 2;
          });
        map.set(colId, mids);
      });
      snapRef.current = map;
    }, []);

    const slotAt = React.useCallback((clientX: number, clientY: number): Slot | null => {
      const d = dragRef.current;
      if (!d) return null;

      let inside = "";
      let nearestId = "";
      let nearest = Infinity;
      colRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) inside = id;
        const dx = Math.abs(clientX - (r.left + r.width / 2));
        if (dx < nearest) {
          nearest = dx;
          nearestId = id;
        }
      });
      const colId = inside || nearestId;
      if (!colId) return null;

      const list = listRefs.current.get(colId);
      if (!list) return { col: colId, index: 0 };

      const listTop = list.getBoundingClientRect().top;
      const mids = snapRef.current.get(colId) ?? [];

      let index = mids.length;
      for (let i = 0; i < mids.length; i++) {
        if (clientY < listTop + mids[i]) {
          index = i;
          break;
        }
      }
      return { col: colId, index };
    }, []);

    const endDrag = React.useCallback(
      (upX?: number, upY?: number) => {
        const d = dragRef.current;
        const s = slotRef.current;
        if (d) {
          const dx = upX != null ? upX - d.startClientX : 0;
          const dy = upY != null ? upY - d.startClientY : 0;
          const moved = Math.hypot(dx, dy) > DRAG_THRESHOLD;
          if (moved && s) {
            move(d.taskId, s);
          } else if (!moved) {
            onTaskClick?.(d.taskId);
          }
        }
        dragRef.current = null;
        slotRef.current = null;
        autoScroll.current = 0;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setDrag(null);
        setSlot(null);
      },
      [move, onTaskClick],
    );

    React.useEffect(() => {
      if (!drag) return;

      const onMove = (e: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        x.set(e.clientX - d.offsetX);
        y.set(e.clientY - d.offsetY);

        const next = slotAt(e.clientX, e.clientY);
        const cur = slotRef.current;
        if (next && (!cur || cur.col !== next.col || cur.index !== next.index)) {
          slotRef.current = next;
          setSlot(next);
        }

        const track = trackRef.current;
        if (track) {
          const r = track.getBoundingClientRect();
          const edge = 72;
          autoScroll.current = e.clientX < r.left + edge ? -14 : e.clientX > r.right - edge ? 14 : 0;
        }
      };

      const onUp = (e: PointerEvent) => endDrag(e.clientX, e.clientY);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        if (autoScroll.current && trackRef.current) {
          trackRef.current.scrollLeft += autoScroll.current;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [drag, endDrag, slotAt, x, y]);

    const startDrag = (e: React.PointerEvent, task: KanbanTask, colId: string, index: number) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const state: DragState = {
        taskId: task.id,
        fromCol: colId,
        width: r.width,
        height: r.height,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      x.set(r.left);
      y.set(r.top);
      snapshot(task.id, colId);
      dragRef.current = state;
      slotRef.current = { col: colId, index };
      setDrag(state);
      setSlot({ col: colId, index });
      setGrabbed(null);
    };

    const originRef = React.useRef<Slot | null>(null);

    const onCardKeyDown = (e: React.KeyboardEvent, task: KanbanTask) => {
      const isGrabbed = grabbed === task.id;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isGrabbed) {
          setGrabbed(null);
          const at = locate(cols, task.id);
          setAnnouncement(
            at ? `${task.title} solto em ${colName(cols, at.col)}, posição ${at.index + 1}.` : "",
          );
        } else {
          const at = locate(cols, task.id);
          originRef.current = at ? { col: at.col, index: at.index } : null;
          setGrabbed(task.id);
          setAnnouncement(`${task.title} selecionado. Use as setas pra mover.`);
        }
        return;
      }

      if (e.key === "Escape" && isGrabbed) {
        e.preventDefault();
        if (originRef.current) move(task.id, originRef.current);
        setGrabbed(null);
        setAnnouncement(`Cancelado. ${task.title} voltou pro lugar.`);
        return;
      }

      if (!isGrabbed) return;
      const at = locate(cols, task.id);
      if (!at) return;
      const colIndex = cols.findIndex((c) => c.id === at.col);

      let to: Slot | null = null;
      if (e.key === "ArrowUp") to = { col: at.col, index: Math.max(0, at.index - 1) };
      if (e.key === "ArrowDown")
        to = { col: at.col, index: Math.min(cols[colIndex].tasks.length - 1, at.index + 1) };
      if (e.key === "ArrowLeft" && colIndex > 0)
        to = { col: cols[colIndex - 1].id, index: Math.min(at.index, cols[colIndex - 1].tasks.length) };
      if (e.key === "ArrowRight" && colIndex < cols.length - 1)
        to = { col: cols[colIndex + 1].id, index: Math.min(at.index, cols[colIndex + 1].tasks.length) };

      if (to) {
        e.preventDefault();
        move(task.id, to);
        setAnnouncement(`${task.title} movido pra ${colName(cols, to.col)}, posição ${to.index + 1}.`);
      }
    };

    const dragged = drag ? locate(cols, drag.taskId) : null;

    return (
      <div
        ref={ref}
        style={{ "--kanban-font": FONT_STACK, fontFamily: "var(--kanban-font)", ...style } as React.CSSProperties}
        className={cn("w-full select-none text-neutral-950 antialiased dark:text-neutral-50", className)}
        {...props}
      >
        <div
          ref={trackRef}
          role="group"
          aria-label={label}
          onScroll={syncEdges}
          style={mask ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties) : undefined}
          className={cn(
            "flex items-start gap-3 overflow-x-auto pb-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <LayoutGroup>
            {cols.map((col) => {
              const isTarget = slot?.col === col.id && !!drag;
              return (
                <div
                  key={col.id}
                  data-kanban-column={col.id}
                  ref={(el) => {
                    if (el) colRefs.current.set(col.id, el);
                    else colRefs.current.delete(col.id);
                  }}
                  className={cn(
                    "group/col w-[286px] shrink-0 rounded-[16px] p-3 transition-colors duration-200",
                    "bg-neutral-100/70 dark:bg-white/[0.04]",
                    isTarget && "bg-neutral-200/60 dark:bg-white/[0.08]",
                    SQUIRCLE,
                  )}
                >
                  <ColumnHeader
                    col={col}
                    count={
                      col.tasks.length -
                      (drag && drag.fromCol === col.id ? 1 : 0) +
                      (drag && slot?.col === col.id ? 1 : 0)
                    }
                  />

                  <div
                    ref={(el) => {
                      if (el) listRefs.current.set(col.id, el);
                      else listRefs.current.delete(col.id);
                    }}
                    className="mt-3 flex flex-col gap-2"
                  >
                    {col.tasks
                      .filter((t) => t.id !== drag?.taskId)
                      .map((task, i) => (
                        <React.Fragment key={task.id}>
                          {isTarget && slot!.index === i && <Placeholder height={drag!.height} />}
                          <Card
                            task={task}
                            grabbed={grabbed === task.id}
                            reduceMotion={!!reduceMotion}
                            elRef={(el) => {
                              if (el) cardRefs.current.set(task.id, el);
                              else cardRefs.current.delete(task.id);
                            }}
                            onPointerDown={(e) => startDrag(e, task, col.id, i)}
                            onKeyDown={(e) => onCardKeyDown(e, task)}
                          />
                        </React.Fragment>
                      ))}
                    {isTarget &&
                      slot!.index >= col.tasks.filter((t) => t.id !== drag?.taskId).length && (
                        <Placeholder height={drag!.height} />
                      )}
                    {col.tasks.length === 0 && !isTarget && (
                      <div
                        className={cn(
                          "rounded-[12px] border border-dashed py-6 text-center text-[11.5px]",
                          "border-neutral-300 text-neutral-400 dark:border-white/15 dark:text-neutral-500",
                          SQUIRCLE,
                        )}
                      >
                        Arraste um contato aqui
                      </div>
                    )}
                  </div>

                  {onAddTask && (
                    <button
                      type="button"
                      onClick={() => onAddTask(col.id)}
                      className={cn(
                        "mt-2 flex w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-[12.5px] font-medium",
                        "text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-800",
                        "dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100",
                        SQUIRCLE,
                      )}
                    >
                      <Plus aria-hidden className="h-3.5 w-3.5" />
                      Adicionar
                    </button>
                  )}

                  {col.footerNote && !col.onFooterNoteClick && (
                    <div
                      className={cn(
                        "mt-2 rounded-[10px] border border-dashed px-2.5 py-2 text-[11px] leading-snug",
                        "border-neutral-300 text-neutral-500 dark:border-white/15 dark:text-neutral-400",
                      )}
                    >
                      {col.footerNote}
                    </div>
                  )}
                  {col.footerNote && col.onFooterNoteClick && (
                    <button
                      type="button"
                      onClick={col.onFooterNoteClick}
                      className={cn(
                        "mt-2 flex items-start gap-1.5 rounded-[10px] border border-dashed px-2.5 py-2 text-left text-[11px] leading-snug transition-colors",
                        "border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:bg-black/[0.02]",
                        "dark:border-white/15 dark:text-neutral-400 dark:hover:bg-white/[0.04]",
                      )}
                      title="Editar quando avisar"
                    >
                      <span className="flex-1">{col.footerNote}</span>
                      <Pencil aria-hidden className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                    </button>
                  )}
                </div>
              );
            })}
          </LayoutGroup>
        </div>

        <ScrollRail trackRef={trackRef} />

        <AnimatePresence>
          {drag && dragged && (
            <motion.div
              style={{ x, y, width: drag.width }}
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: reduceMotion ? 1 : 1.03, rotate: reduceMotion ? 0 : 1.6 }}
              exit={{ scale: 1, rotate: 0, opacity: 0 }}
              transition={LIFT_SPRING}
              className="pointer-events-none fixed left-0 top-0 z-50 origin-top-left"
            >
              <CardShell task={dragged.task} floating />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    );
  },
);

function colName(cols: KanbanColumn[], id: string) {
  return cols.find((c) => c.id === id)?.name ?? id;
}

function ScrollRail({ trackRef }: { trackRef: React.RefObject<HTMLDivElement | null> }) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [geom, setGeom] = React.useState({ ratio: 1, offset: 0 });
  const [held, setHeld] = React.useState(false);

  const sync = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const max = el.scrollWidth - el.clientWidth;
    setGeom({ ratio, offset: max > 0 ? el.scrollLeft / max : 0 });
  }, [trackRef]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync, trackRef]);

  const scrollTo = React.useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      const el = trackRef.current;
      if (!rail || !el) return;
      const r = rail.getBoundingClientRect();
      const thumbW = r.width * geom.ratio;
      const p = (clientX - r.left - thumbW / 2) / (r.width - thumbW);
      el.scrollLeft = Math.max(0, Math.min(1, p)) * (el.scrollWidth - el.clientWidth);
    },
    [geom.ratio, trackRef],
  );

  React.useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => scrollTo(e.clientX);
    const onUp = () => setHeld(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [held, scrollTo]);

  if (geom.ratio >= 0.999) return null;

  return (
    <div
      ref={railRef}
      onPointerDown={(e) => {
        setHeld(true);
        scrollTo(e.clientX);
      }}
      className="mt-3 h-[6px] w-full cursor-pointer rounded-full bg-black/[0.05] dark:bg-white/[0.07]"
    >
      <div
        style={{ width: `${geom.ratio * 100}%`, marginLeft: `${geom.offset * (100 - geom.ratio * 100)}%` }}
        className={cn(
          "h-full rounded-full transition-colors",
          held
            ? "bg-black/40 dark:bg-white/50"
            : "bg-black/20 hover:bg-black/30 dark:bg-white/25 dark:hover:bg-white/40",
        )}
      />
    </div>
  );
}

function ColumnHeader({ col, count }: { col: KanbanColumn; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", !col.dotColor && ACCENT_DOT[col.accent ?? "slate"])}
        style={col.dotColor ? { background: col.dotColor } : undefined}
      />
      <h3 className="m-0 truncate text-[13px] font-medium tracking-[-0.005em]">{col.name}</h3>
      <motion.span
        key={count}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={FLOW_SPRING}
        className={cn(
          "grid h-[18px] min-w-[18px] place-items-center rounded-[6px] px-1 text-[11px] font-medium tabular-nums",
          "bg-black/[0.06] text-neutral-500 dark:bg-white/[0.09] dark:text-neutral-400",
          SQUIRCLE,
        )}
      >
        {count}
      </motion.span>
      {col.subtitle && (
        <span className="ml-auto text-[11.5px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
          {col.subtitle}
        </span>
      )}
    </div>
  );
}

function Placeholder({ height }: { height: number }) {
  return (
    <motion.div
      layout
      data-kanban-placeholder
      initial={{ opacity: 0, scaleY: 0.7 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.7 }}
      transition={FLOW_SPRING}
      style={{ height }}
      className={cn(
        "origin-top rounded-[12px] border border-dashed",
        "border-neutral-300 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.03]",
        SQUIRCLE,
      )}
    />
  );
}

function Card({
  task,
  grabbed,
  reduceMotion,
  elRef,
  onPointerDown,
  onKeyDown,
}: {
  task: KanbanTask;
  grabbed: boolean;
  reduceMotion: boolean;
  elRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <motion.div
      ref={elRef}
      layout
      data-kanban-card={task.id}
      tabIndex={0}
      role="button"
      aria-roledescription="Cartão arrastável"
      aria-grabbed={grabbed}
      aria-label={`${task.title}. Clique pra abrir, espaço pra arrastar.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      transition={reduceMotion ? { duration: 0 } : FLOW_SPRING}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/25 dark:focus-visible:ring-white/30",
        grabbed && "ring-2 ring-neutral-900/40 dark:ring-white/50",
        "rounded-[12px]",
        SQUIRCLE,
      )}
    >
      <CardShell task={task} />
    </motion.div>
  );
}

function CardShell({ task, floating }: { task: KanbanTask; floating?: boolean }) {
  const hasFooter = !!(task.people?.length || task.due);
  return (
    <div
      className={cn(
        "rounded-[12px] border p-3",
        task.authBlink
          ? "animate-pulse border-orange-400 bg-orange-100 ring-2 ring-orange-300/70 dark:border-orange-500/70 dark:bg-orange-950/40"
          : task.stale
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-950/20"
          : "border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-neutral-900",
        floating ? "shadow-[0_16px_32px_-12px_rgb(0_0_0/0.28)]" : "shadow-[0_1px_2px_rgb(0_0_0/0.05)]",
        SQUIRCLE,
      )}
    >
      {(task.channelKind || task.priority || (task.tags && task.tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {task.channelKind && (
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-neutral-100 text-neutral-700" title={task.channelKind === "site" ? "Site" : task.channelKind === "instagram" ? "Instagram" : "WhatsApp"}>
              {task.channelKind === "site" ? <Globe2 className="h-3.5 w-3.5" /> : task.channelKind === "instagram" ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-[#C13584]" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#C13584" stroke="none"/></svg> : (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#25D366]" aria-label="WhatsApp"><path d="M12 2a9.7 9.7 0 0 0-8.4 14.55L2.2 21.8l5.37-1.4A9.8 9.8 0 1 0 12 2Zm0 17.8a7.8 7.8 0 0 1-3.98-1.09l-.29-.17-3.18.83.85-3.1-.19-.31A7.8 7.8 0 1 1 12 19.8Zm4.28-5.84c-.23-.12-1.39-.69-1.6-.76-.22-.08-.38-.12-.54.12-.16.23-.61.76-.75.92-.14.15-.28.17-.52.05-.23-.12-.99-.36-1.88-1.16a7.08 7.08 0 0 1-1.3-1.62c-.14-.23-.02-.36.1-.47.11-.1.24-.27.35-.4.12-.14.16-.24.24-.4.08-.15.04-.29-.02-.4-.06-.12-.53-1.28-.73-1.75-.2-.46-.4-.4-.54-.4h-.46c-.16 0-.41.06-.63.3-.22.23-.83.81-.83 1.98s.85 2.3.97 2.46c.12.15 1.67 2.55 4.05 3.58.57.24 1.01.39 1.35.5.57.18 1.08.15 1.49.09.45-.07 1.39-.57 1.59-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.45-.28Z"/></svg>
              )}
            </span>
          )}
          {task.priority && (
            <span className={cn(CHIP, "font-medium", PRIORITY_STYLES[task.priority], SQUIRCLE)}>
              <Flag aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
              <span>{PRIORITY_LABELS[task.priority]}</span>
            </span>
          )}
          {task.tags?.slice(0, 3).map((t) => (
            <span key={t.id} className={cn(PILL, "font-medium")} style={{ background: `${t.cor}1a`, color: t.cor }}>
              {t.nome}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2.5">
        {task.unread && (
          <span className={task.unreadBlink ? "relative flex h-2 w-2 shrink-0" : "flex h-2 w-2 shrink-0"}>
            {task.unreadBlink && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
        {/* Parado além do limiar configurado pisca em âmbar — distinto do ponto vermelho
            (mensagem não lida), os dois podem aparecer juntos sem se confundir. */}
        {task.stale && (
          <span className="relative flex h-2 w-2 shrink-0" title="Parado além do tempo configurado pra essa etapa">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
        )}
        <p className="m-0 text-[14px] font-medium leading-snug tracking-[-0.005em] truncate">{task.title}</p>
      </div>

      {task.note && (
        <p className="m-0 mt-1 text-[12px] font-normal leading-snug text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {task.note}
        </p>
      )}

      {hasFooter && (
        <>
          <div className="mt-3 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.due ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11.5px] font-normal tabular-nums",
                  task.dueSoon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                <CalendarDays aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                {task.due}
              </span>
            ) : (
              <span />
            )}
            {task.people && task.people.length > 0 && <AvatarStack people={task.people} />}
          </div>
        </>
      )}
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const skin = "bg-neutral-900 dark:bg-neutral-100";
  return (
    <span className="group/tip relative flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2",
          "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out",
          "group-hover/tip:translate-y-0 group-hover/tip:opacity-100",
          "group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100",
        )}
      >
        <span
          className={cn(
            "block whitespace-nowrap rounded-[7px] px-2 py-1 text-[11px] font-medium leading-none",
            "text-white dark:text-neutral-900",
            skin,
            "shadow-[0_6px_16px_-4px_rgb(0_0_0/0.3)]",
            SQUIRCLE,
          )}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-full h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]",
            skin,
          )}
        />
      </span>
    </span>
  );
}

function AvatarStack({ people }: { people: KanbanPerson[] }) {
  const shown = people.slice(0, 3);
  const rest = people.slice(3);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name + i} className={cn(i > 0 && "-ml-1.5")}>
          <Tooltip label={p.name}>
            <span
              tabIndex={0}
              aria-label={p.name}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full",
                "ring-2 ring-white dark:ring-neutral-900",
                "focus-visible:outline-none focus-visible:ring-neutral-900 dark:focus-visible:ring-white",
              )}
            >
              {p.avatar ? (
                <img src={p.avatar} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <Initials name={p.name} color={p.color} />
              )}
            </span>
          </Tooltip>
        </span>
      ))}
      {rest.length > 0 && (
        <span className="-ml-1.5">
          <Tooltip label={rest.map((p) => p.name).join(", ")}>
            <span
              tabIndex={0}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-medium",
                "bg-neutral-200 text-neutral-600 ring-2 ring-white",
                "dark:bg-white/15 dark:text-neutral-200 dark:ring-neutral-900",
                "focus-visible:outline-none focus-visible:ring-neutral-900 dark:focus-visible:ring-white",
              )}
            >
              +{rest.length}
            </span>
          </Tooltip>
        </span>
      )}
    </div>
  );
}

const INITIAL_TINTS = ["#111214", "#2F6FED", "#7C5CFC", "#D9476B", "#15803D", "#B45309", "#0E7490"];

function Initials({ name, color }: { name: string; color?: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      style={{ background: color ?? INITIAL_TINTS[h % INITIAL_TINTS.length] }}
      className="grid h-full w-full place-items-center text-[9.5px] font-medium text-white"
    >
      {initials}
    </span>
  );
}

export default KanbanBoard;
