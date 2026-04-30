import { ErrorCode, LogLevel, Purchases, PurchasesError } from '@revenuecat/purchases-js';

const DEFAULT_OFFERING_MAP = {
  go: 'go',
  plus: 'plus',
};

const PACKAGE_ORDER = {
  '$rc_annual': 0,
  '$rc_six_month': 1,
  '$rc_three_month': 2,
  '$rc_two_month': 3,
  '$rc_monthly': 4,
  '$rc_weekly': 5,
  '$rc_lifetime': 6,
  custom: 90,
  unknown: 99,
};

let configuredApiKey = null;
let preloadPromise = null;

function parseJsonEnv(rawValue, fallbackValue) {
  if (!rawValue) return fallbackValue;

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function getApiKey() {
  const sandboxKey = process.env.REACT_APP_REVENUECAT_WEB_SANDBOX_API_KEY || '';
  const publicKey =
    process.env.REACT_APP_REVENUECAT_WEB_PUBLIC_API_KEY ||
    process.env.REACT_APP_REVENUECAT_PUBLIC_API_KEY ||
    '';

  if (process.env.NODE_ENV !== 'production' && sandboxKey) {
    return sandboxKey;
  }

  return publicKey;
}

function getCurrency() {
  return process.env.REACT_APP_REVENUECAT_CURRENCY || undefined;
}

function getOfferingMap() {
  return parseJsonEnv(
    process.env.REACT_APP_REVENUECAT_PLAN_OFFERING_MAP_JSON,
    DEFAULT_OFFERING_MAP
  );
}

function getOfferingIdentifier(planCode) {
  const offeringMap = getOfferingMap();
  return offeringMap[planCode] || planCode;
}

function packageSortValue(packageType) {
  return PACKAGE_ORDER[packageType] ?? 999;
}

function titleCase(value) {
  if (!value) return 'Package';
  return value
    .replace(/^\$rc_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPeriod(period) {
  if (!period) return 'One-time';

  if (period.number === 1) {
    const singularMap = {
      year: 'Yearly',
      month: 'Monthly',
      week: 'Weekly',
      day: 'Daily',
    };
    return singularMap[period.unit] || `Per ${titleCase(period.unit)}`;
  }

  return `Every ${period.number} ${titleCase(period.unit)}s`;
}

function formatPricingPhase(phase, prefix) {
  if (!phase) return null;

  const phasePeriod = formatPeriod(phase.period);
  if (!phase.price) {
    return `${prefix} ${phasePeriod.toLowerCase()}`;
  }

  return `${prefix} ${phase.price.formattedPrice} for ${phasePeriod.toLowerCase()}`;
}

function normalizeMetadata(metadata) {
  const normalized = {};
  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    normalized[key] = value === null ? null : String(value);
  });
  return normalized;
}

function mapPackage(rcPackage) {
  if (!rcPackage) return null;

  const product = rcPackage.webBillingProduct;
  const defaultOption = product?.defaultSubscriptionOption;

  return {
    identifier: rcPackage.identifier,
    packageType: rcPackage.packageType,
    label: titleCase(rcPackage.packageType || rcPackage.identifier),
    productIdentifier: product?.identifier || null,
    title: product?.displayName || product?.title || rcPackage.identifier,
    description: product?.description || null,
    price: product?.price?.formattedPrice || 'Unavailable',
    currencyCode: product?.price?.currency || null,
    durationLabel: formatPeriod(product?.period),
    monthlyPrice: defaultOption?.base?.pricePerMonth?.formattedPrice || null,
    yearlyPrice: defaultOption?.base?.pricePerYear?.formattedPrice || null,
    freeTrialLabel: formatPricingPhase(product?.freeTrialPhase, 'Free for'),
    introPriceLabel: formatPricingPhase(product?.introPricePhase, 'Intro'),
    offeringIdentifier: product?.presentedOfferingContext?.offeringIdentifier || null,
  };
}

function sortPackages(packages) {
  return [...packages].sort((left, right) => {
    const leftOrder = packageSortValue(left.packageType);
    const rightOrder = packageSortValue(right.packageType);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.identifier.localeCompare(right.identifier);
  });
}

function selectPackage(offering, packageIdentifier) {
  if (!offering) return null;

  if (packageIdentifier) {
    return offering.packagesById?.[packageIdentifier] || null;
  }

  return (
    offering.annual ||
    offering.monthly ||
    offering.sixMonth ||
    offering.threeMonth ||
    offering.twoMonth ||
    offering.weekly ||
    offering.lifetime ||
    offering.availablePackages?.[0] ||
    null
  );
}

class RevenueCatService {
  isAvailable() {
    return Boolean(getApiKey());
  }

  getConfig() {
    return {
      enabled: this.isAvailable(),
      selectedApiKeyType:
        process.env.NODE_ENV !== 'production' && process.env.REACT_APP_REVENUECAT_WEB_SANDBOX_API_KEY
          ? 'sandbox'
          : 'public',
      currency: getCurrency() || null,
      offeringMap: getOfferingMap(),
    };
  }

  async ensureConfigured(user) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('RevenueCat Web Billing public API key is not configured.');
    }

    const appUserId = user?.revenuecat_app_user_id;
    if (!appUserId) {
      throw new Error('Missing RevenueCat app user ID for the current account.');
    }

    Purchases.setLogLevel(
      process.env.NODE_ENV === 'development' ? LogLevel.Info : LogLevel.Error
    );

    if (!Purchases.isConfigured()) {
      Purchases.configure({
        apiKey,
        appUserId,
      });
      configuredApiKey = apiKey;
      preloadPromise = null;
    }

    const purchases = Purchases.getSharedInstance();
    if (configuredApiKey !== apiKey) {
      throw new Error('RevenueCat was initialized with a different API key. Reload the app and try again.');
    }

    if (purchases.getAppUserId() !== appUserId) {
      await purchases.changeUser(appUserId);
      preloadPromise = null;
    }

    if (!preloadPromise) {
      preloadPromise = purchases.preload().catch(() => undefined);
    }
    await preloadPromise;

    return purchases;
  }

  async getPlanCatalog(user, planCodes = []) {
    const purchases = await this.ensureConfigured(user);
    const currency = getCurrency();
    const offerings = await purchases.getOfferings(currency ? { currency } : undefined);

    const planCatalog = {};
    planCodes
      .filter((planCode) => planCode !== 'free')
      .forEach((planCode) => {
        const offeringIdentifier = getOfferingIdentifier(planCode);
        const offering = offeringIdentifier === 'current'
          ? offerings.current
          : offerings.all?.[offeringIdentifier] || null;

        const packages = sortPackages(
          (offering?.availablePackages || [])
            .map((rcPackage) => mapPackage(rcPackage))
            .filter(Boolean)
        );

        planCatalog[planCode] = {
          planCode,
          offeringIdentifier,
          found: Boolean(offering),
          serverDescription: offering?.serverDescription || null,
          metadata: offering?.metadata || null,
          packages,
        };
      });

    return {
      availableOfferingIds: Object.keys(offerings.all || {}),
      currentOfferingIdentifier: offerings.current?.identifier || null,
      usingSandbox: purchases.isSandbox(),
      appUserId: purchases.getAppUserId(),
      planCatalog,
    };
  }

  async purchasePlanPackage(user, { planCode, packageIdentifier, customerEmail, metadata }) {
    const purchases = await this.ensureConfigured(user);
    const currency = getCurrency();
    const offerings = await purchases.getOfferings(currency ? { currency } : undefined);
    const offeringIdentifier = getOfferingIdentifier(planCode);
    const offering = offeringIdentifier === 'current'
      ? offerings.current
      : offerings.all?.[offeringIdentifier] || null;

    if (!offering) {
      throw new Error(`No RevenueCat offering found for plan "${planCode}".`);
    }

    const rcPackage = selectPackage(offering, packageIdentifier);
    if (!rcPackage) {
      throw new Error(`No purchasable package is configured for plan "${planCode}".`);
    }

    try {
      const purchaseResult = await purchases.purchase({
        rcPackage,
        customerEmail: customerEmail || undefined,
        metadata: normalizeMetadata(metadata),
      });

      return {
        ...purchaseResult,
        selectedPackage: mapPackage(rcPackage),
      };
    } catch (error) {
      if (error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError) {
        const cancelledError = new Error('Checkout cancelled.');
        cancelledError.code = 'user_cancelled';
        throw cancelledError;
      }

      if (error instanceof PurchasesError) {
        const detail = error.underlyingErrorMessage
          ? `${error.message}. ${error.underlyingErrorMessage}`
          : error.message;
        throw new Error(detail || 'RevenueCat purchase failed.');
      }

      throw error;
    }
  }
}

export default new RevenueCatService();