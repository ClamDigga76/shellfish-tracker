export function to2(n){
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : x;
}

export function createFormatDateDMY(formatDateLegacyDMY){
  return function formatDateDMY(input){
    if(input == null || input === "") return "";

    if(typeof input === "string"){
      const s = input.trim();
      if(!s) return "";
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if(m){
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if(!(y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return "";
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if(dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== mo || dt.getUTCDate() !== d) return "";
        return `${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${String(dt.getUTCDate()).padStart(2, "0")}/${dt.getUTCFullYear()}`;
      }
    }

    const dt = (input instanceof Date) ? input : new Date(input);
    if(Number.isNaN(dt.getTime())) return formatDateLegacyDMY(input);
    return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
  };
}

export function iconSvg(name){
  if(name === "calendar"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 2v3"/><path d="M16 2v3"/>
      <path d="M3 7h18"/>
      <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
      <path d="M7 11h4"/>
    </svg>`;
  }
  return "";
}
