/* One ordered catalog for rendering, theme previews, and saved preferences. */
(() => {
  'use strict';
  // Reference order. Action is the swatch color; accent is its readable ink counterpart.
  const rows = [
    // id, name, scheme, canvas, rail, panel, text, muted, action, on-action, accent, secondary, highlight
    ['ion',       '离子白', 'light', '#F1F1F1','#FCFCFC','#FFFFFF','#222222','#4D5354','#66FF4C','#222222','#26701F','#FF7A47','#D9D4FB'],
    ['runway',    '夜航',   'dark',  '#121415','#0B0C0D','#202324','#F2F0F6','#B1B0BB','#D7FF00','#181A0B','#D7FF00','#5B89C9','#DB5959'],
    ['airwave',   '晴空',   'light', '#EDF4F8','#F8F9F6','#FFFFFF','#141F29','#455E6F','#82AED6','#132B3E','#265980','#DDFD2C','#B8D8EC'],
    ['frost',     '霜玻璃', 'light', '#E9F0F1','#F8FBFC','#F7FBFC','#151D1F','#4B5E62','#182023','#FFFFFF','#285946','#37D45E','#F8AC16'],
    ['steelblue', '雾蓝',   'light', '#DFEAF2','#EFF5F9','#FFFFFF','#292D32','#425662','#8FC2F0','#172D42','#2A577A','#77CE69','#9EBBD0'],
    ['sentry',    '警戒橙', 'light', '#D5D8C5','#EEF0E5','#F5F5ED','#181818','#464C3E','#F9771D','#25190E','#7C3909','#18B880','#CE6969'],
    ['neonbay',   '荧绿舱', 'dark',  '#111826','#141E2E','#202936','#F8FAFF','#AFBACB','#8FFF00','#122000','#8FFF00','#757FA4','#FD7577'],
    ['prism',     '棱镜青', 'light', '#EEF5F2','#FFFFFF','#FCFFFE','#292A2F','#45585E','#63E6E6','#20292E','#14676D','#5DF69A','#FFDD66'],
    ['pulse',     '脉冲白', 'light', '#F4F3F1','#FAF9F8','#FFFFFF','#0C0C0D','#51565D','#89FE71','#18221A','#245E32','#E83858','#FFEA2E'],
    ['cargo',     '货舱紫', 'light', '#DCE0E4','#F3F5F7','#FFFFFF','#161626','#484B60','#6968FF','#000000','#37328F','#AFFF00','#FFBC5B'],
    ['cobalt',    '钴蓝',   'light', '#E6EAEC','#F5F8FC','#F9FBFF','#0D0D0D','#445366','#3F73F6','#000000','#254BAF','#66FF4C','#BECBF0'],
    ['pastel',    '薄荷织锦','light','#EEF2F6','#FCFDFF','#FFFFFF','#1B2526','#465C5E','#96D8D0','#142C2D','#205E60','#DAF4AA','#BEB9CC'],
    ['windline',  '风场蓝', 'light', '#E4EAF4','#F3F6FB','#F9FBFF','#172537','#41546B','#6789BE','#0C172A','#284D81','#FFFF00','#EB4425'],
    ['tide',      '潮汐青', 'light', '#E9EDEC','#F8FAFA','#FFFFFF','#172428','#45585D','#2CA0A3','#0F2226','#19646B','#7CFE9D','#D1D1D1'],
    ['survey',    '测绘橙', 'light', '#E9E9E9','#F7F7F4','#FFFFFF','#2E2E2E','#515459','#FE5E0E','#251605','#853602','#FAF5B2','#C8C8C8'],
    ['alloy',     '合金灰', 'light', '#D4DAE0','#E7EBEF','#F2F4F6','#303133','#454E58','#A8FF1A','#1B2510','#3C571A','#B8C0C9','#E74044'],
    ['blueprint', '工事蓝', 'light', '#ECF1F6','#F8FAFD','#FFFFFF','#202934','#415568','#53A2F7','#11253B','#1C548A','#FFB83D','#B6D7F5']
  ];
  const palettes = Object.freeze(rows.map(([id,label,scheme,bg,rail,surface,text,muted,action,onAction,accent,secondary,highlight],index)=>Object.freeze({id,label,scheme,bg,rail,surface,text,muted,action,onAction,accent,secondary,highlight,number:index+1})));
  const defaultId='runway';
  const normalize=id=>palettes.some(p=>p.id===id)?id:defaultId;
  const catalog=Object.freeze({palettes,defaultId,normalize});
  if (typeof module==='object'&&module.exports) {module.exports=catalog;return;}
  window.TFXThemes=catalog;

  // Preview chips use their own palette vars; only the root theme changes the app.
  const style=document.createElement('style');
  style.textContent=palettes.map(p=>`
    html[data-theme="${p.id}"] {
      --bg:${p.bg}; --rail:${p.rail}; --surface:${p.surface}; --text:${p.text}; --muted:${p.muted};
      --action:${p.action}; --on-action:${p.onAction}; --accent:${p.accent}; --secondary:${p.secondary}; --highlight:${p.highlight};
      --palette-scheme:${p.scheme};
      --raised:color-mix(in srgb,var(--surface) 93%,var(--text)); --control:color-mix(in srgb,var(--surface) 77%,var(--text));
      --line:color-mix(in srgb,var(--surface) 84%,var(--text)); --faint:var(--muted);
      --action-hover:color-mix(in srgb,var(--action) 97%,var(--on-action));
      --accent-hover:color-mix(in srgb,var(--accent) 88%,var(--text)); --accent-tint:color-mix(in srgb,var(--action) 18%,var(--surface));
      --green:${p.scheme==='dark'?'#8BDC97':'#236B46'}; --green-bg:color-mix(in srgb,var(--green) 14%,var(--surface));
      --warning:${p.scheme==='dark'?'#FFCA73':'#815008'}; --danger:${p.scheme==='dark'?'#FF8B8F':'#A43342'};
      --wall-tint:color-mix(in srgb,var(--bg) 80%,transparent); color-scheme:${p.scheme};
    }
    [data-palette="${p.id}"] .theme-swatch {--sample-bg:${p.bg}; --sample-rail:${p.rail}; --sample-action:${p.action}; --sample-secondary:${p.secondary}; --sample-text:${p.text}; --sample-highlight:${p.highlight};}
  `).join('\n');
  document.head.append(style);
})();
