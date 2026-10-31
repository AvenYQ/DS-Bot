// The court board's own styles: the entry button in the sidebar's foot, the full-area
// pane, the floating name tags, and the official card and roster sheets.
import { SEALS } from './data.js'
import { SPRING_TAP, SPRING_POP } from '../motion.js'

export const COURT_BOARD_CSS = `
/* The mark: the app icon's cinnabar seal, colour for the sidebar's foot, ink for the rail. */
.bt-cb-seal{display:block;flex:none;overflow:visible}
.bt-cb-seal-body{fill:var(--bt-cinnabar);stroke:none}
.bt-cb-seal-frame{fill:none;stroke:var(--bt-paper);stroke-width:22;opacity:.85}
.bt-cb-seal-eave{fill:none;stroke:var(--bt-paper);stroke-width:26;stroke-linecap:round}
.bt-cb-seal-dot{fill:var(--bt-paper);stroke:none}
.bt-cb-seal-small .bt-cb-seal-frame{display:none}
.bt-cb-seal-mono .bt-cb-seal-body{fill:none;stroke:currentColor;stroke-width:54;stroke-linejoin:round}
.bt-cb-seal-mono .bt-cb-seal-frame{display:none}
.bt-cb-seal-mono .bt-cb-seal-eave,.bt-cb-seal-mono .bt-cb-seal-dot{stroke:currentColor;fill:none}
.bt-cb-seal-mono .bt-cb-seal-dot{fill:currentColor;stroke:none}

/* The foot's entry: a round seal that opens into a capsule leftwards on hover. The capsule
   floats over the account's name instead of taking room, so nothing beside it moves. */
.bt-leftcol-foot:has(.bt-cb-entry){position:relative}
.bt-leftcol-foot:has(.bt-cb-entry) .bt-you-name{max-width:180px;opacity:1;visibility:visible;transform:translateX(0);transition:max-width 300ms cubic-bezier(.22,1,.36,1),opacity 150ms ease,transform 300ms cubic-bezier(.22,1,.36,1),visibility 0s}
.bt-leftcol-foot:has(.bt-cb-entry[data-open=true]) .bt-you-name,.bt-leftcol-foot:has(.bt-cb-entry-btn:focus-visible) .bt-you-name{max-width:0;opacity:0;visibility:hidden;text-overflow:clip;transform:translateX(-8px);transition:opacity 100ms ease,max-width 300ms cubic-bezier(.22,1,.36,1),transform 300ms cubic-bezier(.22,1,.36,1),visibility 0s 100ms}
.bt-cb-entry{position:static;display:flex;align-items:center;flex:none;margin-left:auto;width:36px;height:36px}
.bt-cb-entry-btn{position:absolute;z-index:2;right:0;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:0;padding:0;border-radius:999px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2),0 1px 2px rgba(0,0,0,.06);cursor:pointer;color:var(--bt-ink);overflow:hidden;transition:width 420ms cubic-bezier(.22,1,.36,1),border-radius 420ms cubic-bezier(.22,1,.36,1),background-color .12s ease,transform 360ms cubic-bezier(.2,1.35,.35,1),box-shadow 220ms ease}
.bt-cb-entry[data-open=true] .bt-cb-entry-btn,.bt-cb-entry-btn:focus-visible{width:calc(100% - 48px)}
.bt-cb-entry-btn:hover{background:var(--bt-hover)}
.bt-cb-entry-btn:active{transform:scale(.96);box-shadow:inset 0 3px 8px rgba(0,0,0,.25),inset 0 1px 2px rgba(0,0,0,.16);transition-duration:90ms}
.bt-cb-entry-copy{display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;opacity:0;transition:opacity 160ms ease}
.bt-cb-entry[data-open=true] .bt-cb-entry-copy,.bt-cb-entry-btn:focus-visible .bt-cb-entry-copy{opacity:1;transition-delay:100ms}
.bt-cb-entry-icon{position:absolute;right:0;display:grid;place-items:center;width:36px;height:36px}
.bt-cb-entry-label{font-size:13px;line-height:18px;font-weight:500;color:var(--bt-ink);overflow:hidden;text-overflow:ellipsis}
.bt-cb-entry-count{font-size:12px;line-height:16px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}

/* The rail's entry: the same mark in ink, no fill, a hover tint like the icons above it. */
.bt-cb-rail-entry{display:grid;place-items:center;width:32px;height:32px;border:0;padding:0;border-radius:8px;background:none;color:color-mix(in srgb,var(--bt-ink) 72%,transparent);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-cb-rail-entry:hover{background:var(--bt-hover);color:var(--bt-ink)}
@media (prefers-reduced-motion:reduce){.bt-cb-entry-btn,.bt-leftcol-foot:has(.bt-cb-entry) .bt-you-name{transition:none}}

/* The board itself: the conversation's place, the sidebar untouched. */
.bt-cb-pane{position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;z-index:46;display:flex;flex-direction:column;background:var(--bt-main);color:var(--bt-ink);font-family:var(--bt-font);pointer-events:auto}
.bt-cb-head{display:flex;align-items:center;gap:10px;height:44px;flex:none;padding:0 10px 0 18px;-webkit-app-region:drag}
.bt-cb-head button{-webkit-app-region:no-drag}
.bt-cb-title{font-size:15px;line-height:20px;font-weight:600;letter-spacing:.04em}
.bt-cb-sub{font-size:13px;line-height:18px;color:var(--bt-ink-2)}
.bt-cb-head-spacer{flex:1}
.bt-cb-clock{font-size:13px;line-height:18px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}
.bt-cb-tab{height:28px;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;cursor:pointer}
.bt-cb-tab:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-cb-tab[data-on=true]{background:var(--bt-active);color:var(--bt-ink)}
.bt-cb-x{display:grid;place-items:center;width:32px;height:32px;border:0;padding:0;border-radius:999px;background:none;color:var(--bt-ink-2);cursor:pointer;font-size:18px;line-height:1}
.bt-cb-x:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-cb-stage{position:relative;flex:1;min-height:0;overflow:hidden}
.bt-cb-stage canvas{display:block;width:100%;height:100%}
.bt-cb-tags{position:absolute;z-index:1;inset:0;pointer-events:none;overflow:hidden}
/* The scene writes the name tags with its own inline styles, as the source page did; these
   rules take them over so they follow the theme and stay readable in the dark. */
.bt-cb-tags .tag{pointer-events:auto;cursor:pointer}
.bt-cb-tags .tag .bub{background:var(--bt-card)!important;color:var(--bt-ink)!important;font-size:13px!important;line-height:18px!important;border-radius:10px!important;box-shadow:0 3px 10px rgba(0,0,0,.16)!important}
.bt-cb-tags .tag .bub.alert{background:var(--bt-cinnabar)!important;color:var(--bt-paper)!important}
.bt-cb-tags .tag .bub.zz{background:var(--bt-ink)!important;color:var(--bt-main)!important}
.bt-cb-tags .tag .nm{background:var(--bt-ink)!important;color:var(--bt-main)!important;font-size:13px!important;line-height:18px!important;border-radius:999px!important}
.bt-cb-tags .tag.sel .nm{background:var(--bt-cinnabar)!important;color:var(--bt-paper)!important}

/* Sheets: the official card on the right, the roster on the left. */
.bt-cb-sheet{position:absolute;z-index:5;top:12px;width:320px;max-height:calc(100% - 24px);overflow:auto;padding:14px 16px;border-radius:16px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2),0 10px 30px rgba(0,0,0,.12);font-size:13px;line-height:19px;color:var(--bt-ink)}
.bt-cb-sheet[hidden]{display:none}
.bt-cb-card{right:14px}
.bt-cb-roster{left:14px}
@media (prefers-reduced-motion:no-preference){
  .bt-cb-card{animation:bt-cb-card-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
  .bt-cb-roster{animation:bt-cb-roster-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
  .bt-cb-card[data-closing]{animation:bt-cb-card-out 180ms ease-in forwards}
  .bt-cb-roster[data-closing]{animation:bt-cb-roster-out 180ms ease-in forwards}
  .bt-cb-state b.bt-cb-stamp,.bt-cb-row .s[data-kind=pending],.bt-cb-row .s[data-kind=question],.bt-cb-row .s[data-kind=done]{animation:bt-cb-stamp-in ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
}
@media (prefers-reduced-motion:no-preference){
  .bt-cb-entry,.bt-cb-rail-entry{animation:bt-cb-entry-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
}
@keyframes bt-cb-entry-in{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}
@keyframes bt-cb-card-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes bt-cb-roster-in{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
@keyframes bt-cb-card-out{to{opacity:0;transform:translateX(12px)}}
@keyframes bt-cb-roster-out{to{opacity:0;transform:translateX(-12px)}}
@keyframes bt-cb-stamp-in{from{opacity:0;transform:scale(1.2)}to{opacity:1;transform:scale(1)}}
.bt-cb-sheet-head{display:flex;align-items:center;gap:10px}
.bt-cb-ava{width:40px;height:40px;flex:none;border-radius:999px;display:grid;place-items:center;overflow:hidden;background:var(--bt-tag-bg)}
.bt-cb-ava img{width:100%;height:100%;object-fit:cover}
.bt-cb-who{min-width:0;flex:1}
.bt-cb-name{font-size:15px;line-height:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-role{font-size:13px;line-height:18px;color:var(--bt-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-state{margin:12px 0 8px;padding:9px 11px;border-radius:12px;background:var(--bt-tag-bg);font-size:13px;line-height:19px}
.bt-cb-state b{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;font-size:12px;line-height:17px;background:var(--bt-ink-2);color:var(--bt-main)}
.bt-cb-state[data-kind=work] b{background:var(--bt-star)}
.bt-cb-state[data-kind=pending],.bt-cb-state[data-kind=question],.bt-cb-state[data-kind=done]{background:var(--bt-tag-bg)}
.bt-cb-state b.bt-cb-stamp,.bt-cb-row .s[data-kind=pending],.bt-cb-row .s[data-kind=question],.bt-cb-row .s[data-kind=done]{display:inline-grid;place-items:center;width:22px;height:22px;box-sizing:border-box;padding:0;border:2px double var(--bt-paper);border-radius:4px;color:var(--bt-paper);font-size:12px;line-height:1;font-weight:600}
.bt-cb-state[data-kind=pending] b,.bt-cb-row .s[data-kind=pending]{background:${SEALS.pending.color}}
.bt-cb-state[data-kind=question] b,.bt-cb-row .s[data-kind=question]{background:${SEALS.question.color}}
.bt-cb-state[data-kind=done] b,.bt-cb-row .s[data-kind=done]{background:${SEALS.done.color}}
.bt-cb-state[data-kind=sleep] b{background:var(--bt-ink)}
.bt-cb-h{font-size:13px;line-height:18px;font-weight:600;color:var(--bt-ink-2);margin:12px 0 6px;letter-spacing:.08em}
.bt-cb-log{list-style:none;margin:0;padding:0}
.bt-cb-log li{display:grid;grid-template-columns:46px 1fr;gap:8px;padding:5px 0;border-top:1px dashed var(--bt-line);font-size:13px;line-height:18px}
.bt-cb-log li:first-child{border-top:0}
.bt-cb-log .t{color:var(--bt-ink-2);font-variant-numeric:tabular-nums;font-size:12px}
.bt-cb-desc{font-size:13px;line-height:19px;color:var(--bt-ink-2)}
.bt-cb-actions{display:flex;gap:8px;margin-top:12px}
.bt-cb-btn{flex:1;height:32px;border:0;border-radius:10px;padding:0 12px;background:var(--bt-ink);color:var(--bt-main);font:inherit;font-size:13px;cursor:pointer}
.bt-cb-btn:hover{opacity:.88}
.bt-cb-btn[data-kind=plain]{background:var(--bt-tag-bg);color:var(--bt-ink)}
.bt-cb-grp{margin-top:10px}
.bt-cb-grp h4{margin:0 0 4px;font-size:12px;line-height:16px;font-weight:600;color:var(--bt-ink-2);letter-spacing:.1em}
.bt-cb-row{display:flex;align-items:center;gap:9px;width:100%;padding:6px 7px;border:0;border-radius:10px;background:none;text-align:left;font:inherit;font-size:13px;line-height:18px;color:var(--bt-ink);cursor:pointer}
.bt-cb-row:hover{background:var(--bt-hover)}
.bt-cb-row[data-selected=true]{background:var(--bt-active)}
.bt-cb-row .d{width:20px;height:20px;flex:none;border-radius:999px}
.bt-cb-row .n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-row .s{flex:none;font-size:12px;line-height:17px;padding:1px 8px;border-radius:999px;background:var(--bt-tag-bg);color:var(--bt-ink-2)}
.bt-cb-row .s[data-kind=work]{background:var(--bt-star);color:var(--bt-paper)}
.bt-cb-empty{padding:8px 0;color:var(--bt-ink-2);font-size:13px}
`
