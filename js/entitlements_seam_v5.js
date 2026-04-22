export const ENTITLEMENT_PLAN_FREE = "free";
export const ENTITLEMENT_PLAN_PAID = "paid";

export const ENTITLEMENT_PLANS = Object.freeze({
  FREE: ENTITLEMENT_PLAN_FREE,
  PAID: ENTITLEMENT_PLAN_PAID
});

export const ENTITLEMENT_FEATURE_KEYS = Object.freeze({
  REPORTS: "reports",
  PREMIUM_KPI_CHARTS: "premiumKpiCharts",
  HOME_CUSTOM_RANGE: "homeCustomRange"
});

const PLAN_FEATURES = Object.freeze({
  [ENTITLEMENT_PLAN_FREE]: Object.freeze([]),
  [ENTITLEMENT_PLAN_PAID]: Object.freeze([
    ENTITLEMENT_FEATURE_KEYS.REPORTS,
    ENTITLEMENT_FEATURE_KEYS.PREMIUM_KPI_CHARTS,
    ENTITLEMENT_FEATURE_KEYS.HOME_CUSTOM_RANGE
  ])
});

export function createEntitlementsSeam({
  getState,
  setState,
  defaultPlan = ENTITLEMENT_PLAN_FREE
} = {}){
  const normalizePlan = (rawPlan)=> {
    const candidate = String(rawPlan || "").trim().toLowerCase();
    return PLAN_FEATURES[candidate] ? candidate : defaultPlan;
  };

  function getCurrentPlan(){
    const state = getState?.() || {};
    return normalizePlan(state?.settings?.plan);
  }

  function getAllowedFeatures(plan = getCurrentPlan()){
    return [...(PLAN_FEATURES[normalizePlan(plan)] || [])];
  }

  function isFeatureAllowed(featureKey, plan = getCurrentPlan()){
    const key = String(featureKey || "").trim();
    return key ? getAllowedFeatures(plan).includes(key) : false;
  }

  function ensurePlanState(){
    const state = getState?.();
    if(!state || typeof state !== "object") return false;
    const normalizedPlan = normalizePlan(state?.settings?.plan);

    if(!state.settings || typeof state.settings !== "object") state.settings = {};

    if(state.settings.plan !== normalizedPlan){
      state.settings.plan = normalizedPlan;
      setState?.(state);
      return true;
    }

    return false;
  }

  return {
    ENTITLEMENT_PLANS,
    ENTITLEMENT_FEATURE_KEYS,
    getCurrentPlan,
    getAllowedFeatures,
    isFeatureAllowed,
    ensurePlanState
  };
}
