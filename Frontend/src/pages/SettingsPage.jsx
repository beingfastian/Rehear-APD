import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Copy,
  CreditCard,
  ExternalLink,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import revenueCatService from '../services/revenueCat';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('rehear_user'));
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDate(value) {
  if (!value) return 'Unavailable';

  try {
    return new Date(value).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return 'Unavailable';
  }
}

function orderPlans(plans) {
  const order = { free: 0, go: 1, plus: 2 };
  return [...plans].sort((left, right) => {
    const leftRank = order[left.code] ?? 99;
    const rightRank = order[right.code] ?? 99;
    return leftRank - rightRank;
  });
}

function getPlanCheckoutMessage({ user, revenueCatEnabled, isLoadingCheckout, checkoutError, checkoutPlan, availableOfferingIds }) {
  if (!user) {
    return 'Sign in first so checkout can be tied to your RevenueCat app user ID.';
  }

  if (!revenueCatEnabled) {
    return 'RevenueCat Web Billing is not configured in this environment. Add the public API key and offering map env vars.';
  }

  if (isLoadingCheckout) {
    return 'Loading RevenueCat offerings and package prices…';
  }

  if (checkoutError) {
    return checkoutError;
  }

  if (checkoutPlan && !checkoutPlan.found) {
    const offeringList = availableOfferingIds.length > 0 ? availableOfferingIds.join(', ') : 'none';
    return `No offering found for "${checkoutPlan.offeringIdentifier}". Available offerings: ${offeringList}.`;
  }

  return 'No purchasable packages are attached to this plan yet.';
}

const SettingsPage = ({ setCurrentPage }) => {
  const { showNotification } = useApp();
  const [user, setUser] = useState(() => getStoredUser());
  const [plans, setPlans] = useState([]);
  const [billing, setBilling] = useState(null);
  const [checkoutCatalog, setCheckoutCatalog] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activePurchaseKey, setActivePurchaseKey] = useState('');

  const revenueCatConfig = revenueCatService.getConfig();
  const revenueCatEnabled = revenueCatConfig.enabled;

  const loadCheckoutCatalog = async (currentUser, nextPlans, notifyOnError = false) => {
    if (!currentUser || !revenueCatEnabled) {
      setCheckoutCatalog(null);
      setCheckoutError('');
      return;
    }

    setIsLoadingCheckout(true);
    try {
      const catalog = await revenueCatService.getPlanCatalog(
        currentUser,
        nextPlans.map((plan) => plan.code)
      );
      setCheckoutCatalog(catalog);
      setCheckoutError('');
    } catch (error) {
      setCheckoutCatalog(null);
      setCheckoutError(error.message || 'Failed to load RevenueCat offerings.');
      if (notifyOnError) {
        showNotification(error.message || 'Failed to load RevenueCat offerings.', 'warning');
      }
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const loadBillingData = async (notifyCheckoutErrors = false) => {
    const currentUser = getStoredUser();
    setUser(currentUser);
    setIsLoading(true);

    try {
      if (currentUser) {
        const [plansData, billingData] = await Promise.all([
          apiService.getBillingPlans(),
          apiService.getBillingStatus(),
        ]);
        const orderedPlans = orderPlans(plansData.plans || []);
        setPlans(orderedPlans);
        setBilling(billingData);
        await loadCheckoutCatalog(currentUser, orderedPlans, notifyCheckoutErrors);
        return;
      }

      const plansData = await apiService.getBillingPlans();
      const orderedPlans = orderPlans(plansData.plans || []);
      setPlans(orderedPlans);
      setBilling(null);
      await loadCheckoutCatalog(null, orderedPlans, false);
    } catch (error) {
      setBilling(null);
      showNotification(error.message || 'Failed to load billing details', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData(false);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const billingData = await apiService.syncRevenueCatSubscription();
      setBilling(billingData);
      setUser(getStoredUser());
      await loadCheckoutCatalog(getStoredUser(), plans, true);
      showNotification('Subscription state synced from RevenueCat.', 'success');
    } catch (error) {
      showNotification(error.message || 'Failed to sync subscription state', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopy = async (value, label) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      showNotification(`${label} copied to clipboard.`, 'success');
    } catch {
      showNotification(`Unable to copy ${label.toLowerCase()}.`, 'warning');
    }
  };

  const handlePurchaseClick = async (planCode, packageIdentifier) => {
    if (!user) {
      showNotification('Sign in first so RevenueCat can associate the purchase with your account.', 'info');
      return;
    }

    if (!revenueCatEnabled) {
      showNotification('RevenueCat Web Billing is not configured in this environment.', 'warning');
      return;
    }

    const purchaseKey = `${planCode}:${packageIdentifier || 'default'}`;
    setActivePurchaseKey(purchaseKey);

    try {
      const result = await revenueCatService.purchasePlanPackage(user, {
        planCode,
        packageIdentifier,
        customerEmail: user.email,
        metadata: {
          source: 'settings_page',
          plan_code: planCode,
        },
      });

      showNotification(
        `Checkout completed for ${result.selectedPackage?.label || planCode}. Syncing subscription state…`,
        'success'
      );

      try {
        const billingData = await apiService.syncRevenueCatSubscription();
        setBilling(billingData);
      } catch (error) {
        showNotification(
          error.message || 'Purchase completed, but backend sync did not finish.',
          'warning'
        );
      }

      if (result.redemptionInfo) {
        showNotification(
          'RevenueCat returned redemption details. Review your web-to-app handoff if you intend to support anonymous purchases.',
          'info'
        );
      }

      await loadBillingData(true);
    } catch (error) {
      if (error.code === 'user_cancelled') {
        showNotification('Checkout cancelled.', 'info');
      } else {
        showNotification(error.message || 'Unable to start checkout.', 'error');
      }
    } finally {
      setActivePurchaseKey('');
    }
  };

  const activePlanCode = billing?.plan_code || 'free';
  const includedCredits = billing?.included_credits || 0;
  const usedCredits = billing?.used_credits || 0;
  const remainingCredits = billing?.remaining_credits || 0;
  const usagePercent = includedCredits > 0 ? Math.min(100, Math.round((usedCredits / includedCredits) * 100)) : 0;
  const usageByModel = billing?.usage_by_model || {};
  const usageByOperation = billing?.usage_by_operation || {};
  const userDisplayName = user?.name || 'Guest';
  const availableOfferingIds = checkoutCatalog?.availableOfferingIds || [];

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Access</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review plan access, monitor AI credit usage, and purchase web subscriptions through RevenueCat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadBillingData(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>

          <button
            onClick={handleSync}
            disabled={!user || isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-200 hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isSyncing ? 'Syncing…' : 'Sync RevenueCat'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold uppercase tracking-wide mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                Access State
              </div>
              <h2 className="text-xl font-bold text-gray-900">{userDisplayName}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {user ? user.email : 'Sign in to attach plans and usage to a real account.'}
              </p>
            </div>

            <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              billing?.subscription_active
                ? 'bg-green-50 text-green-700 border-green-100'
                : 'bg-gray-50 text-gray-600 border-gray-100'
            }`}>
              {billing?.subscription_active ? `${activePlanCode.toUpperCase()} ACTIVE` : 'FREE ACCESS'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">RevenueCat App User</p>
              <p className="mt-2 text-sm font-semibold text-gray-900 break-all">
                {user?.revenuecat_app_user_id || 'Generated after signup'}
              </p>
              <button
                onClick={() => handleCopy(user?.revenuecat_app_user_id, 'App user ID')}
                disabled={!user?.revenuecat_app_user_id}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-800 disabled:opacity-40"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy ID
              </button>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Subscription Management</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {billing?.management_url ? 'Store subscription controls available' : 'Waiting for a synced store subscription'}
              </p>
              {billing?.management_url ? (
                <a
                  href={billing.management_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open management link
                </a>
              ) : (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                  This appears after RevenueCat syncs an active App Store, Play Store, or Web Billing purchase.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Current Plan</p>
              <p className="mt-2 text-lg font-bold text-gray-900">{activePlanCode.toUpperCase()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {billing?.subscription_active ? 'Entitlement is active' : 'No active paid entitlement'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Period Window</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{formatDate(billing?.current_period_start)}</p>
              <p className="text-xs text-gray-500 mt-1">Until {formatDate(billing?.current_period_end)}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Last Sync</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{formatDate(billing?.last_synced_at)}</p>
              <p className="text-xs text-gray-500 mt-1">Use sync after checkout, restore, or plan changes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wide mb-4">
            <Gauge className="w-3.5 h-3.5" />
            Credit Usage
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading credit summary…</p>
            </div>
          ) : user ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Included</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(includedCredits)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Used</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(usedCredits)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Remaining</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(remainingCredits)}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
                  <span>Consumption this period</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className="h-3 rounded-full bg-sky-50 overflow-hidden border border-sky-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Plan Notes</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>Credit limits are enforced only for authenticated requests.</li>
                  <li>Sync RevenueCat after checkout or management changes.</li>
                  <li>Whisper usage is measured from transcription duration, not returned token counts.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <BadgeCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-800">Sign in to unlock usage tracking</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Credits and subscriptions are linked to the authenticated user, so the dashboard becomes fully active after login.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Plans</h2>
              <p className="text-sm text-gray-500 mt-1">Each paid plan can now launch Web Billing directly from the package buttons below.</p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              <CreditCard className="w-3.5 h-3.5" />
              {revenueCatEnabled ? 'RevenueCat Web Billing' : 'Checkout Not Configured'}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {revenueCatEnabled ? 'Web checkout is enabled for this environment.' : 'Add the RevenueCat web public API key to enable checkout.'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                API key mode: {revenueCatConfig.selectedApiKeyType}. Currency override: {revenueCatConfig.currency || 'auto-detect'}.
              </p>
            </div>

            {checkoutCatalog?.currentOfferingIdentifier && (
              <div className="text-xs text-gray-500">
                Current offering: <span className="font-semibold text-gray-700">{checkoutCatalog.currentOfferingIdentifier}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isActivePlan = activePlanCode === plan.code;
              const isPaidPlan = plan.code !== 'free';
              const checkoutPlan = checkoutCatalog?.planCatalog?.[plan.code];
              const packageOptions = checkoutPlan?.packages || [];
              const isManagedPlan = isActivePlan && billing?.subscription_active;
              const checkoutMessage = getPlanCheckoutMessage({
                user,
                revenueCatEnabled,
                isLoadingCheckout,
                checkoutError,
                checkoutPlan,
                availableOfferingIds,
              });

              return (
                <div
                  key={plan.code}
                  className={`rounded-2xl border p-5 transition-all ${
                    isActivePlan
                      ? 'border-sky-200 bg-sky-50/70 shadow-sm'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{plan.code}</p>
                      <h3 className="mt-2 text-xl font-bold text-gray-900">{plan.display_name}</h3>
                    </div>
                    {isActivePlan && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-sky-100 text-sky-700 text-[11px] font-bold uppercase tracking-wide">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="text-3xl font-bold text-gray-900">{formatNumber(plan.monthly_credits)}</p>
                    <p className="text-sm text-gray-500 mt-1">credits per month</p>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-gray-600">
                    <p className="font-semibold text-gray-800">Entitlements</p>
                    {plan.entitlements?.length ? (
                      plan.entitlements.map((entitlement) => (
                        <div key={entitlement} className="inline-flex mr-2 mb-2 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700">
                          {entitlement}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Base access without a paid RevenueCat entitlement.</p>
                    )}
                  </div>

                  {checkoutPlan?.serverDescription && (
                    <p className="mt-4 text-xs text-gray-500 leading-relaxed">
                      {checkoutPlan.serverDescription}
                    </p>
                  )}

                  {isPaidPlan && packageOptions.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {packageOptions.map((pkg) => {
                        const purchaseKey = `${plan.code}:${pkg.identifier}`;
                        const isPurchasing = activePurchaseKey === purchaseKey;

                        return (
                          <button
                            key={pkg.identifier}
                            onClick={() => handlePurchaseClick(plan.code, pkg.identifier)}
                            disabled={Boolean(activePurchaseKey) || isManagedPlan}
                            className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                              isManagedPlan
                                ? 'bg-white border-gray-200 opacity-60 cursor-default'
                                : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{pkg.label}</p>
                                <p className="text-xs text-gray-500 mt-1">{pkg.durationLabel}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{pkg.price}</p>
                                {pkg.monthlyPrice && pkg.monthlyPrice !== pkg.price && (
                                  <p className="text-[11px] text-gray-500 mt-1">{pkg.monthlyPrice}/mo effective</p>
                                )}
                              </div>
                            </div>

                            {(pkg.freeTrialLabel || pkg.introPriceLabel) && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {pkg.freeTrialLabel && (
                                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-100">
                                    {pkg.freeTrialLabel}
                                  </span>
                                )}
                                {pkg.introPriceLabel && (
                                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-100">
                                    {pkg.introPriceLabel}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mt-3 text-xs font-semibold text-blue-700 flex items-center gap-2">
                              {isPurchasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                              {isManagedPlan ? 'Managed from current subscription' : isPurchasing ? 'Opening checkout…' : 'Purchase with RevenueCat'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
                      {isLoadingCheckout && isPaidPlan ? (
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading checkout packages…
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-500 leading-relaxed">{isPaidPlan ? checkoutMessage : 'The free tier remains available without web checkout.'}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {isManagedPlan && billing?.management_url && (
                    <a
                      href={billing.management_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Manage current subscription
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Usage Breakdown
          </div>

          {Object.keys(usageByModel).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(usageByModel).map(([model, details]) => (
                <div key={model} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">{model}</p>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {formatNumber(details.credits)} credits
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Events</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatNumber(details.events)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Tokens</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatNumber(details.tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Characters</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatNumber(details.characters)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Audio Seconds</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatNumber(details.audio_seconds)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <Gauge className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-800">No completed usage yet</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Usage cards will populate after authenticated OpenAI requests complete.
              </p>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Operations</p>
            {Object.keys(usageByOperation).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(usageByOperation).map(([operation, details]) => (
                  <div key={operation} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{operation}</span>
                    <span className="text-gray-500">
                      {formatNumber(details.events)} events · {formatNumber(details.credits)} credits
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Operation-level usage appears after the first authenticated request cycle.</p>
            )}
          </div>
        </div>
      </div>

      
    </div>
  );
};

export default SettingsPage;