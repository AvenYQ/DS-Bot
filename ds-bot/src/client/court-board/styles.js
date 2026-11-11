// The court board's own styles: the entry button in the sidebar's foot, the full-area
// pane and its status bar, the floating tags over the city, the 奏事簿 and roster on the
// left and the official's card on the right.
import { COURT_TOKENS, COURT_TOKENS_DARK } from './data.js'
import { SPRING_TAP, SPRING_POP } from '../motion.js'

const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif'

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
.bt-cb-entry-count{font-size:13px;line-height:16px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}

/* The rail's entry: the same mark in ink, no fill, a hover tint like the icons above it. */
.bt-cb-rail-entry{display:grid;place-items:center;width:32px;height:32px;border:0;padding:0;border-radius:8px;background:none;color:color-mix(in srgb,var(--bt-ink) 72%,transparent);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-cb-rail-entry:hover{background:var(--bt-hover);color:var(--bt-ink)}
@media (prefers-reduced-motion:reduce){.bt-cb-entry-btn,.bt-leftcol-foot:has(.bt-cb-entry) .bt-you-name{transition:none}}
@media (prefers-reduced-motion:no-preference){
  .bt-cb-entry,.bt-cb-rail-entry{animation:bt-cb-entry-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
}
@keyframes bt-cb-entry-in{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}

/* The board: the conversation's place, the sidebar untouched. */
.bt-cb-pane{${COURT_TOKENS};position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;z-index:46;display:block;background:var(--bt-main);color:var(--bt-ink);font-family:var(--bt-font);pointer-events:auto;-webkit-font-smoothing:auto}
body[data-ds-dark-theme] .bt-cb-pane{${COURT_TOKENS_DARK}}
.bt-cb-head{position:absolute;z-index:6;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:12px;height:54px;padding:0 8px 0 12px;border-radius:18px;background:var(--cb-glass);box-shadow:0 0 0 .5px var(--cb-glass-line),0 10px 30px var(--cb-shadow);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);-webkit-app-region:drag}
.bt-cb-head button{-webkit-app-region:no-drag}
.bt-cb-mark{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:10px;background:var(--bt-tag-bg)}
.bt-cb-heading{display:flex;flex-direction:column;min-width:0;flex:none}
.bt-cb-title{font-family:${SERIF};font-size:17px;line-height:22px;font-weight:700;letter-spacing:.08em;white-space:nowrap}
.bt-cb-sub{font-size:13px;line-height:17px;color:var(--bt-ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.bt-cb-head-spacer{flex:1}
.bt-cb-tallies{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;margin-left:10px}
.bt-cb-tally{--cb-dot:var(--cb-idle);display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px 0 10px;border:0;border-radius:999px;background:var(--bt-tag-bg);color:var(--bt-ink);font:inherit;font-size:13px;line-height:18px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color .12s ease,transform .18s ease}
.bt-cb-tally:hover:not(:disabled){background:var(--bt-active)}
.bt-cb-tally:active:not(:disabled){transform:scale(.96)}
.bt-cb-tally:disabled{cursor:default;color:var(--bt-ink-2)}
.bt-cb-tally i{width:8px;height:8px;border-radius:50%;background:var(--cb-dot);flex:none}
.bt-cb-tally b{font-weight:700;font-variant-numeric:tabular-nums}
.bt-cb-tally[data-kind=work]{--cb-dot:var(--cb-work)}
.bt-cb-tally[data-kind=court]{--cb-dot:var(--cb-court)}
.bt-cb-tally[data-kind=pending]{--cb-dot:var(--cb-gold-deep)}
.bt-cb-tally[data-kind=done]{--cb-dot:var(--bt-cinnabar)}
.bt-cb-tally[data-kind=waiting]{--cb-dot:var(--cb-wait)}
.bt-cb-tally[data-kind=work]:not(:disabled) i{box-shadow:0 0 0 0 var(--cb-work);animation:bt-cb-beat 1.6s ease-out infinite}
.bt-cb-tally[data-kind=pending] i{animation:bt-cb-beat 1.2s ease-out infinite}
@keyframes bt-cb-beat{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--cb-dot) 60%,transparent)}100%{box-shadow:0 0 0 7px transparent}}
.bt-cb-seg{display:flex;padding:3px;border-radius:999px;background:var(--bt-tag-bg);flex:none}
.bt-cb-seg button{height:28px;padding:0 13px;border:0;border-radius:999px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background-color .15s ease,color .15s ease,box-shadow .15s ease}
.bt-cb-seg button:hover{color:var(--bt-ink)}
.bt-cb-seg button[data-on=true]{background:var(--bt-card);color:var(--bt-ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.bt-cb-icon{display:grid;place-items:center;width:34px;height:34px;flex:none;border:0;padding:0;border-radius:999px;background:none;color:var(--bt-ink-2);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-cb-icon:hover{background:var(--bt-hover);color:var(--bt-ink)}

.bt-cb-stage{position:absolute;inset:0;overflow:hidden}
.bt-cb-world{position:absolute;inset:0;transition:background 1.2s ease}
.bt-cb-stage canvas{display:block;width:100%;height:100%;outline:none}
.bt-cb-broken{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);max-width:420px;padding:14px 18px;border-radius:16px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2);font-size:14px;line-height:22px;text-align:center;color:var(--bt-ink-2)}

/* The sky behind the terrace: the gradient is set on the world by the scene, the sun or
   moon rides its arc, the stars come out with the night. */
.cb-sky{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.cb-stars{position:absolute;inset:0 0 35% 0;opacity:calc(var(--cb-night,0) * .9);transition:opacity 1.2s ease;background-image:radial-gradient(1.2px 1.2px at 12% 18%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 27% 42%,var(--cb-star) 60%,transparent),radial-gradient(1.4px 1.4px at 44% 12%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 63% 30%,var(--cb-star) 60%,transparent),radial-gradient(1.2px 1.2px at 78% 9%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 88% 38%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 6% 52%,var(--cb-star) 60%,transparent),radial-gradient(1.3px 1.3px at 53% 55%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 35% 70%,var(--cb-star) 60%,transparent),radial-gradient(1px 1px at 95% 62%,var(--cb-star) 60%,transparent);background-size:420px 300px}
.cb-orb{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle at 50% 50%,var(--cb-sun) 0 52%,var(--cb-sun-halo) 53%,transparent 72%);transform:scale(1.9);transition:left 1.5s ease,top 1.5s ease}
.cb-orb[data-moon=true]{background:none;transform:none;box-shadow:inset -10px -3px 0 0 var(--cb-moon),0 0 24px var(--cb-moon-glow)}

/* Tags over the terrace: each official's name, and above it what he is doing. They sit on
   the scene, not the theme, so they keep their paper look in the dark. */
.bt-cb-tags{position:absolute;z-index:1;inset:0;pointer-events:none;overflow:hidden}
.cb-tag{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0;border:0;background:none;font:inherit;cursor:pointer;pointer-events:auto;will-change:transform}
.cb-bub{position:relative;display:inline-flex;align-items:center;gap:6px;max-width:264px;padding:5px 11px;border-radius:12px;background:var(--cb-tag-paper);color:var(--cb-tag-ink);font-size:13px;line-height:19px;font-weight:500;white-space:normal;text-align:left;box-shadow:0 6px 16px var(--cb-tag-shade),0 0 0 .5px var(--cb-tag-edge);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.cb-tag[data-say="1"] .cb-bub{border-radius:12px;background:var(--bt-paper);color:var(--bt-ink);box-shadow:0 8px 22px var(--cb-tag-shade),0 0 0 1px var(--cb-tag-edge)}
.cb-bub[hidden]{display:none}
.cb-txt{overflow:hidden;text-overflow:ellipsis;min-width:0}
.cb-txt:empty{display:none}
.cb-time{flex:none;color:var(--cb-tag-ink-2);font-variant-numeric:tabular-nums;font-size:11px}
.cb-time:empty{display:none}
.cb-tag .cb-seal{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;margin-left:-3px;box-sizing:border-box;border:1.5px double var(--cb-seal-paper);border-radius:4px;background:var(--cb-vermilion);color:var(--cb-seal-paper);font-style:normal;font-family:${SERIF};font-size:11px;font-weight:700;line-height:1;transform:rotate(-6deg)}
.cb-tag .cb-seal[hidden]{display:none}
.cb-tag[data-kind=pending] .cb-seal{background:var(--cb-pending)}
.cb-tag[data-kind=question] .cb-seal{background:var(--cb-question)}
.cb-tag[data-kind=work] .cb-bub::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--cb-work);--cb-dot:var(--cb-work);animation:bt-cb-beat 1.4s ease-out infinite}
.cb-tag[data-kind=court] .cb-bub{background:var(--cb-court);color:var(--cb-seal-paper)}
.cb-tag[data-kind=waiting] .cb-bub{color:var(--cb-wait-ink)}
.cb-tag[data-kind=pending] .cb-bub,.cb-tag[data-kind=question] .cb-bub{font-weight:600}
.cb-nm{display:inline-flex;align-items:baseline;gap:4px;padding:2px 9px 3px;border-radius:999px;background:var(--cb-tag-paper-2);color:var(--cb-tag-ink);font-size:12px;line-height:16px;white-space:nowrap;box-shadow:0 2px 8px var(--cb-tag-shade),0 0 0 .5px var(--cb-tag-edge);transition:background-color .15s ease,color .15s ease,transform .2s ease,opacity .2s ease}
.cb-nm small{font-size:11px;color:var(--cb-tag-ink-2)}
.cb-nm small:empty{display:none}
.cb-nm b{font-family:${SERIF};font-weight:700;letter-spacing:.04em}
.cb-tag.main .cb-nm b::before{content:"";display:inline-block;width:5px;height:5px;margin:0 5px 2px 0;border-radius:50%;background:var(--cb-gold);vertical-align:middle}
.cb-tag[data-kind=sleep] .cb-nm,.cb-tag[data-kind=idle] .cb-nm{background:var(--cb-tag-paper-3);box-shadow:none}
.cb-tag[data-kind=sleep] .cb-nm{color:var(--cb-tag-ink-2)}
.cb-tag:hover .cb-nm,.cb-tag.hover .cb-nm{background:var(--cb-tag-hover);transform:translateY(-1px)}
.cb-tag.sel .cb-nm{background:var(--cb-tag-ink);color:var(--cb-seal-paper)}
.cb-tag.sel .cb-nm small{color:var(--cb-tag-sel-ink-2)}
.cb-zz{display:none;font-family:${SERIF};font-style:italic;font-size:12px;letter-spacing:.3em;color:var(--cb-zz);text-shadow:0 1px 3px var(--cb-zz-shade)}
.cb-tag[data-kind=sleep] .cb-zz{display:block}
.cb-tag.cb-behind{opacity:.16;transition:opacity .25s ease}
.cb-tag{transition:opacity .25s ease}
.cb-far .cb-tag[data-kind=idle]:not(.sel):not(.hover) .cb-nm,.cb-far .cb-tag[data-kind=sleep]:not(.sel):not(.hover) .cb-nm{opacity:0}
.cb-far .cb-nm small{display:none}
.cb-far .cb-txt{max-width:96px}
.cb-run{position:absolute;left:0;top:0;padding:3px 10px;border-radius:999px;background:var(--cb-run);color:var(--cb-tag-ink);box-shadow:0 0 0 1px var(--cb-gold),0 6px 16px var(--cb-tag-shade);font-size:12px;line-height:17px;font-weight:600;white-space:nowrap;pointer-events:none;z-index:1500}
.cb-tag.cb-ambient{cursor:default}
.cb-room{position:absolute;left:0;top:0;padding:4px 14px;border-radius:999px;background:var(--cb-court);color:var(--cb-seal-paper);box-shadow:0 8px 22px var(--cb-room-shade);font-family:${SERIF};font-size:13px;line-height:19px;font-weight:700;letter-spacing:.12em;white-space:nowrap;pointer-events:none}
.cb-proclaim{position:absolute;left:50%;top:84px;transform:translateX(-50%);padding:9px 26px;border-radius:4px;background:var(--cb-seal-paper);color:var(--cb-tag-ink);box-shadow:inset 0 0 0 1px var(--cb-gold),inset 0 0 0 4px var(--cb-seal-paper),inset 0 0 0 5px color-mix(in srgb,var(--cb-gold) 60%,transparent),0 14px 34px var(--cb-shadow);font-family:${SERIF};font-size:16px;line-height:22px;font-weight:700;letter-spacing:.3em;white-space:nowrap;z-index:1001}
.cb-proclaim[hidden]{display:none}
@media (prefers-reduced-motion:no-preference){
  .cb-proclaim:not([hidden]){animation:bt-cb-unroll 700ms ${SPRING_POP.easing}}
  .cb-tag .cb-seal:not([hidden]){animation:bt-cb-stamp-in ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
  .cb-tag[data-kind=pending] .cb-bub,.cb-tag[data-kind=question] .cb-bub{animation:bt-cb-bob 1.6s ease-in-out infinite}
  .cb-tag[data-kind=sleep] .cb-zz{animation:bt-cb-zz 3.2s ease-in-out infinite}
  .cb-bub:not([hidden]){animation:bt-cb-bub-in 260ms ${SPRING_POP.easing}}
}
@keyframes bt-cb-unroll{from{opacity:0;clip-path:inset(0 50% 0 50%)}to{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes bt-cb-bob{0%,100%{translate:0 0}50%{translate:0 -3px}}
@keyframes bt-cb-stamp-in{from{opacity:0;transform:rotate(-6deg) scale(1.6)}to{opacity:1;transform:rotate(-6deg) scale(1)}}
@keyframes bt-cb-zz{0%{opacity:0;translate:-4px 4px}40%{opacity:1}100%{opacity:0;translate:6px -8px}}
@keyframes bt-cb-bub-in{from{opacity:0;scale:.85}to{opacity:1;scale:1}}

.bt-cb-hint{position:absolute;z-index:4;left:50%;bottom:18px;transform:translateX(-50%);padding:7px 14px;border-radius:999px;background:var(--cb-glass);color:var(--bt-ink-2);box-shadow:0 0 0 .5px var(--cb-glass-line),0 6px 18px var(--cb-shadow);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);font-size:13px;line-height:18px;white-space:nowrap;pointer-events:none}
@media (prefers-reduced-motion:no-preference){.bt-cb-hint{animation:bt-cb-hint 7s ease forwards}}
@keyframes bt-cb-hint{0%{opacity:0;translate:0 8px}8%,85%{opacity:1;translate:0 0}100%{opacity:0}}

/* Glass sheets: the 奏事簿 or the roster on the left, the official's card on the right. */
.bt-cb-sheet,.bt-cb-side{position:absolute;z-index:5;top:78px;box-sizing:border-box;max-height:calc(100% - 92px);border-radius:18px;background:var(--cb-glass);color:var(--bt-ink);box-shadow:0 0 0 .5px var(--cb-glass-line),0 14px 40px var(--cb-shadow);-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);font-size:13px;line-height:19px}
.bt-cb-side{left:14px;bottom:14px;width:292px;display:flex;flex-direction:column;overflow:hidden}
.bt-cb-side-head{display:flex;align-items:baseline;gap:8px;padding:14px 16px 10px;border-bottom:.5px solid var(--cb-glass-line);flex:none}
.bt-cb-side-title{font-family:${SERIF};font-size:16px;line-height:22px;font-weight:700;letter-spacing:.1em}
.bt-cb-side-sub{font-size:13px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}
.bt-cb-feed{list-style:none;margin:0;padding:6px 8px 10px;overflow:auto;flex:1;min-height:0}
.bt-cb-feed-row{--cb-dot:var(--cb-idle);display:grid;grid-template-columns:42px 10px 1fr;align-items:start;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.bt-cb-feed-row:hover:not(:disabled){background:var(--bt-hover)}
.bt-cb-feed-row:disabled{cursor:default}
.bt-cb-feed-row .t{color:var(--bt-ink-2);font-variant-numeric:tabular-nums;font-size:13px;line-height:19px}
.bt-cb-feed-row .d{width:10px;height:10px;margin-top:5px;border-radius:50%;box-shadow:0 0 0 2px var(--cb-glass)}
.bt-cb-feed-row .c{min-width:0;display:flex;flex-direction:column}
.bt-cb-feed-row .c b{font-weight:700;font-size:13px}
.bt-cb-feed-row .c span{color:var(--bt-ink-2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.bt-cb-feed-row[data-kind=work] .c span{color:var(--bt-ink)}
.bt-cb-feed-row[data-kind=pending] .c span,.bt-cb-feed-row[data-kind=question] .c span{color:var(--cb-gold-deep);font-weight:600}
.bt-cb-feed-row[data-kind=done] .c span{color:var(--bt-cinnabar);font-weight:600}
.bt-cb-feed-row[data-kind=decree] .c span{color:var(--cb-plaque);font-weight:700}
body[data-ds-dark-theme] .bt-cb-feed-row[data-kind=decree] .c span{color:var(--cb-plaque-gold)}
.bt-cb-feed-empty{padding:18px 16px;line-height:21px}
.bt-cb-roster{overflow:auto;flex:1;min-height:0;padding:4px 8px 10px}
.bt-cb-grp h4{margin:10px 8px 4px;font-family:${SERIF};font-size:13px;line-height:18px;font-weight:700;color:var(--bt-ink-2);letter-spacing:.2em}
.bt-cb-row{display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border:0;border-radius:10px;background:none;text-align:left;font:inherit;font-size:13px;line-height:18px;color:var(--bt-ink);cursor:pointer}
.bt-cb-row:hover{background:var(--bt-hover)}
.bt-cb-row[data-selected=true]{background:var(--bt-active)}
.bt-cb-row .d{width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.bt-cb-row .n{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;white-space:nowrap;overflow:hidden}
.bt-cb-row .n b{font-weight:700}
.bt-cb-row .n span{color:var(--bt-ink-2);overflow:hidden;text-overflow:ellipsis}
.bt-cb-pill{flex:none;display:inline-block;padding:1px 9px;border-radius:999px;background:var(--bt-tag-bg);color:var(--bt-ink-2);font-size:13px;line-height:18px;font-weight:500}
.bt-cb-pill[data-kind=work]{background:color-mix(in srgb,var(--cb-work) 18%,transparent);color:var(--cb-gold-deep)}
.bt-cb-pill[data-kind=court]{background:var(--cb-court);color:var(--cb-paper)}
.bt-cb-pill[data-kind=waiting]{background:color-mix(in srgb,var(--cb-wait) 16%,transparent);color:var(--cb-wait)}
.bt-cb-pill[data-kind=sleep]{background:color-mix(in srgb,var(--cb-sleep) 16%,transparent);color:var(--cb-sleep)}
.bt-cb-stamp{display:inline-grid;place-items:center;flex:none;width:26px;height:26px;box-sizing:border-box;border:2px double var(--cb-paper);border-radius:4px;background:var(--cb-seal);color:var(--cb-paper);font-family:${SERIF};font-size:14px;font-weight:700;line-height:1;transform:rotate(-6deg);box-shadow:0 1px 3px rgba(0,0,0,.2)}
.bt-cb-stamp-sm{width:22px;height:22px;font-size:13px}

.bt-cb-card{right:14px;width:340px;overflow:auto;padding:16px}
@media (prefers-reduced-motion:no-preference){
  .bt-cb-card{animation:bt-cb-card-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
  .bt-cb-card[data-closing]{animation:bt-cb-card-out 180ms ease-in forwards}
  .bt-cb-side{animation:bt-cb-side-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
  .bt-cb-stamp{animation:bt-cb-stamp-in ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
}
@keyframes bt-cb-card-in{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes bt-cb-card-out{to{opacity:0;transform:translateX(14px)}}
@keyframes bt-cb-side-in{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
.bt-cb-card-top{display:flex;align-items:center;gap:12px}
.bt-cb-ava{width:52px;height:52px;flex:none;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--bt-tag-bg);box-shadow:0 0 0 3px var(--cb-glass),0 0 0 5px var(--cb-robe)}
.bt-cb-ava img{width:100%;height:100%;object-fit:cover}
.bt-cb-who{min-width:0;flex:1}
.bt-cb-name{font-family:${SERIF};font-size:20px;line-height:26px;font-weight:700;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-role{font-size:13px;line-height:18px;color:var(--bt-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-now{margin:14px 0 10px;padding:12px 13px;border-radius:12px;background:var(--bt-tag-bg);border-left:3px solid var(--cb-idle)}
.bt-cb-now[data-kind=work]{border-left-color:var(--cb-work);background:color-mix(in srgb,var(--cb-work) 10%,transparent)}
.bt-cb-now[data-kind=court]{border-left-color:var(--cb-court);background:color-mix(in srgb,var(--cb-court) 9%,transparent)}
.bt-cb-now[data-kind=pending],.bt-cb-now[data-kind=question]{border-left-color:var(--cb-gold-deep);background:color-mix(in srgb,var(--cb-gold) 14%,transparent)}
.bt-cb-now[data-kind=done]{border-left-color:var(--bt-cinnabar);background:color-mix(in srgb,var(--bt-cinnabar) 8%,transparent)}
.bt-cb-now[data-kind=waiting]{border-left-color:var(--cb-wait)}
.bt-cb-now[data-kind=sleep]{border-left-color:var(--cb-sleep)}
.bt-cb-now-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.bt-cb-timer{margin-left:auto;font-size:13px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}
.bt-cb-now-line{font-size:15px;line-height:22px;font-weight:600}
.bt-cb-now-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;font-size:13px;line-height:18px;color:var(--bt-ink-2);word-break:break-all}
.bt-cb-now-meta code{padding:1px 6px;border-radius:6px;background:var(--bt-tag-bg);font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--bt-ink)}
.bt-cb-desc{margin:0 0 4px;font-size:13px;line-height:20px;color:var(--bt-ink-2)}
.bt-cb-desc b{margin-right:6px;color:var(--bt-ink);font-weight:700}
.bt-cb-h{display:flex;align-items:center;gap:8px;margin:16px 0 6px;font-family:${SERIF};font-size:14px;line-height:18px;font-weight:700;letter-spacing:.14em;color:var(--bt-ink)}
.bt-cb-h::after{content:"";flex:1;height:.5px;background:var(--cb-glass-line)}
.bt-cb-log{list-style:none;margin:0;padding:0 0 0 12px;border-left:2px solid var(--cb-glass-line)}
.bt-cb-log li{position:relative;padding:5px 0 7px}
.bt-cb-log li::before{content:"";position:absolute;left:-17px;top:11px;width:8px;height:8px;border-radius:50%;background:var(--cb-robe);box-shadow:0 0 0 2px var(--cb-glass)}
.bt-cb-log .q{font-size:13px;line-height:18px;color:var(--bt-ink-2)}
.bt-cb-log .a{font-size:13px;line-height:19px;color:var(--bt-ink)}
.bt-cb-sched .bt-section-title{display:none}
.bt-cb-actions{display:flex;gap:8px;margin-top:16px}
.bt-cb-btn{flex:1;height:36px;border:0;border-radius:10px;padding:0 12px;background:var(--bt-ink);color:var(--bt-main);font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .12s ease,transform .15s ease}
.bt-cb-btn:hover{opacity:.88}
.bt-cb-btn:active{transform:scale(.97)}
.bt-cb-btn[data-kind=urgent]{background:var(--bt-cinnabar);color:var(--bt-paper)}
.bt-cb-btn[data-kind=plain]{background:var(--bt-tag-bg);color:var(--bt-ink)}
.bt-cb-empty{padding:6px 0;color:var(--bt-ink-2);font-size:13px}

/* Narrow panes: the sheets give the city room. */
@media (max-width:1100px){
  .bt-cb-side{width:256px}
  .bt-cb-card{width:300px}
  .bt-cb-tally[data-kind=idle],.bt-cb-tally[data-kind=waiting]{display:none}
}
@media (max-width:860px){
  .bt-cb-sub{display:none}
  .bt-cb-tally span{display:none}
}
`
