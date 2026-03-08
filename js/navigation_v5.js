const NAV_STACK_LIMIT = 50;

export function ensureNavState(state){
  if(!state || typeof state !== "object") state = {};
  if(!Array.isArray(state.navStack)) state.navStack = [];
  return state;
}

export function navReset(state){
  state.navStack = [];
}

export function createNavigator({ saveState, render }){
  function pushView(state, nextView, { resetStack = false } = {}){
    if(resetStack) navReset(state);
    if(state.view !== nextView){
      state.navStack.push(state.view);
      if(state.navStack.length > NAV_STACK_LIMIT){
        state.navStack.splice(0, state.navStack.length - NAV_STACK_LIMIT);
      }
    }
    state.view = nextView;
    saveState();
    render();
  }

  function goBack(state, { fallback = "home" } = {}){
    const stack = Array.isArray(state.navStack) ? state.navStack : [];
    let prev = null;
    while(stack.length){
      const c = stack.pop();
      if(c && c !== state.view){ prev = c; break; }
    }
    state.navStack = stack;
    state.view = prev || fallback;
    saveState();
    render();
  }

  function bindNavHandlers(state){
    const back = document.getElementById("navBack");
    if(back) back.onclick = () => goBack(state);

    const cancel = document.getElementById("navCancel");
    if(cancel) cancel.onclick = () => goBack(state);

    const home = document.getElementById("navHome");
    if(home) home.onclick = () => pushView(state, "home", { resetStack: true });

    const help = document.getElementById("homeHelp");
    if(help) help.onclick = () => { state.view = "help"; state.lastAction = "nav:help"; saveState(); render(); };
  }

  return { pushView, goBack, bindNavHandlers };
}
