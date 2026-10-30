// The court board's own styles: the entry button in the sidebar's foot, the full-area
// pane, the floating name tags, and the official card and roster sheets.
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
.bt-cb-entry{position:relative;display:flex;align-items:center;justify-content:flex-end;flex:none;margin-left:auto;width:36px;height:36px}
.bt-cb-entry-btn{position:relative;z-index:2;display:grid;place-items:center;width:36px;height:36px;flex:none;border:0;padding:0;border-radius:999px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2),0 1px 2px rgba(0,0,0,.06);cursor:pointer;color:var(--bt-ink);transition:background-color .12s ease,transform 120ms cubic-bezier(.2,0,0,1)}
.bt-cb-entry-btn:hover{background:var(--bt-hover)}
.bt-cb-entry-btn:active{transform:scale(.94)}
.bt-cb-entry-pill{position:absolute;z-index:1;right:0;top:0;bottom:0;display:flex;align-items:center;gap:8px;max-width:196px;padding:0 46px 0 14px;border-radius:999px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line-2),0 1px 2px rgba(0,0,0,.06);white-space:nowrap;overflow:hidden;opacity:0;transform:translateX(10px);pointer-events:none;transition:opacity 140ms ease,transform 200ms cubic-bezier(.2,0,0,1)}
.bt-cb-entry[data-open=true] .bt-cb-entry-pill{opacity:1;transform:none}
.bt-cb-entry-label{font-size:13px;line-height:18px;font-weight:500;color:var(--bt-ink);overflow:hidden;text-overflow:ellipsis}
.bt-cb-entry-count{font-size:12px;line-height:16px;color:var(--bt-ink-2);font-variant-numeric:tabular-nums}

/* The rail's entry: the same mark in ink, no fill, a hover tint like the icons above it. */
.bt-cb-rail-entry{display:grid;place-items:center;width:32px;height:32px;border:0;padding:0;border-radius:8px;background:none;color:color-mix(in srgb,var(--bt-ink) 72%,transparent);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-cb-rail-entry:hover{background:var(--bt-hover);color:var(--bt-ink)}

/* The board itself: the conversation's place, the sidebar untouched. */
.bt-cb-pane{position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;z-index:46;display:flex;flex-direction:column;background:var(--bt-main);color:var(--bt-ink);font-family:var(--bt-font);pointer-events:auto}
.bt-cb-head{display:flex;align-items:center;gap:10px;height:44px;flex:none;padding:0 10px 0 18px}
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
.bt-cb-tags{position:absolute;inset:0;pointer-events:none;overflow:hidden}
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
.bt-cb-sheet-head{display:flex;align-items:center;gap:10px}
.bt-cb-ava{width:40px;height:40px;flex:none;border-radius:999px;display:grid;place-items:center;overflow:hidden;background:var(--bt-tag-bg)}
.bt-cb-ava img{width:100%;height:100%;object-fit:cover}
.bt-cb-who{min-width:0;flex:1}
.bt-cb-name{font-size:15px;line-height:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-role{font-size:13px;line-height:18px;color:var(--bt-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-cb-state{margin:12px 0 8px;padding:9px 11px;border-radius:12px;background:var(--bt-tag-bg);font-size:13px;line-height:19px}
.bt-cb-state b{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;font-size:12px;line-height:17px;background:var(--bt-ink-2);color:var(--bt-main)}
.bt-cb-state[data-kind=work] b{background:var(--bt-star)}
.bt-cb-state[data-kind=pending]{background:color-mix(in srgb,var(--bt-cinnabar) 12%,transparent)}
.bt-cb-state[data-kind=pending] b{background:var(--bt-cinnabar);color:var(--bt-paper)}
.bt-cb-state[data-kind=done] b{background:var(--bt-green)}
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
.bt-cb-row .s[data-kind=pending]{background:var(--bt-cinnabar);color:var(--bt-paper)}
.bt-cb-row .s[data-kind=done]{background:var(--bt-green);color:var(--bt-paper)}
.bt-cb-empty{padding:8px 0;color:var(--bt-ink-2);font-size:13px}
`
